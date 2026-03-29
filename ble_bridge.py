"""
BLE Bridge — TremorSpoon → server.js
=====================================
Connects to the ESP32 "TremorSpoon" device over BLE, subscribes to sensor
notifications, and forwards them to the Node.js WebSocket server on
ws://localhost:3000.

Also listens for mode commands from the server and writes them back to the
ESP32's RX characteristic.

Install dependencies:
    pip install bleak websockets

Run:
    python ble_bridge.py
"""

import asyncio
import json
import logging
import sys
from bleak import BleakClient, BleakScanner
import websockets
from websockets.exceptions import ConnectionClosed

# ── Config ────────────────────────────────────────────────────────────────────
WS_URI          = "ws://localhost:3000"
DEVICE_NAME     = "TremorSpoon"
SERVICE_UUID    = "12345678-1234-1234-1234-123456789abc"
TX_CHAR_UUID    = "abcdef01-1234-1234-1234-123456789abc"  # BLE notify (ESP32 → bridge)
RX_CHAR_UUID    = "abcdef02-1234-1234-1234-123456789abc"  # BLE write  (bridge → ESP32)
BRIDGE_VERSION  = "1.0"
BLE_RETRY_S     = 5   # seconds between BLE reconnect attempts
WS_RETRY_S      = 3   # seconds between WebSocket reconnect attempts

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("bridge")

# ── Shared state ──────────────────────────────────────────────────────────────
ws_conn   = None   # active websockets connection
ble_client = None  # active BleakClient


# ── WebSocket send helper ─────────────────────────────────────────────────────
async def ws_send(obj: dict):
    global ws_conn
    if ws_conn is not None:
        try:
            await ws_conn.send(json.dumps(obj))
        except Exception as e:
            log.warning(f"[WS] Send failed: {e}")
            ws_conn = None


# ── BLE notification handler ──────────────────────────────────────────────────
def on_ble_notify(sender, data: bytearray):
    """Called by bleak on each BLE TX notification from the ESP32."""
    try:
        payload = json.loads(data.decode("utf-8"))
        asyncio.get_event_loop().call_soon_threadsafe(
            lambda: asyncio.ensure_future(
                ws_send({"type": "data", "payload": payload})
            )
        )
    except Exception as e:
        log.warning(f"[BLE] Notify parse error: {e}")


# ── WebSocket listener ────────────────────────────────────────────────────────
async def ws_listen(ws):
    """Forward server commands to the ESP32 RX characteristic."""
    global ble_client
    async for raw in ws:
        try:
            msg = json.loads(raw)
        except Exception:
            continue

        if msg.get("type") == "command" and ble_client and ble_client.is_connected:
            data_bytes = json.dumps(msg.get("data", {})).encode("utf-8")
            try:
                await ble_client.write_gatt_char(RX_CHAR_UUID, data_bytes, response=False)
                log.info(f"[BLE] Sent command: {msg['data']}")
            except Exception as e:
                log.warning(f"[BLE] Write failed: {e}")

        elif msg.get("type") == "ping":
            await ws_send({"type": "pong"})


# ── WebSocket connection loop ─────────────────────────────────────────────────
async def ws_loop():
    """Maintain a persistent WebSocket connection to server.js."""
    global ws_conn
    while True:
        try:
            log.info(f"[WS] Connecting to {WS_URI}…")
            async with websockets.connect(WS_URI) as ws:
                ws_conn = ws
                log.info("[WS] Connected")
                await ws_send({"type": "bridge_hello", "version": BRIDGE_VERSION})
                try:
                    await ws_listen(ws)
                except ConnectionClosed:
                    log.warning("[WS] Connection closed")
                finally:
                    ws_conn = None
        except Exception as e:
            log.warning(f"[WS] Error: {e}. Retrying in {WS_RETRY_S}s…")
            ws_conn = None
            await asyncio.sleep(WS_RETRY_S)


# ── BLE scan and connect ──────────────────────────────────────────────────────
async def find_device():
    """Scan for TremorSpoon by service UUID and return its address."""
    log.info(f"[BLE] Scanning for '{DEVICE_NAME}'…")
    device = await BleakScanner.find_device_by_filter(
        lambda d, adv: d.name == DEVICE_NAME or SERVICE_UUID.lower() in [s.lower() for s in adv.service_uuids],
        timeout=10.0
    )
    if device is None:
        log.warning(f"[BLE] '{DEVICE_NAME}' not found")
    return device


async def ble_loop():
    """Maintain a persistent BLE connection to the ESP32."""
    global ble_client
    while True:
        device = await find_device()
        if device is None:
            await asyncio.sleep(BLE_RETRY_S)
            continue

        log.info(f"[BLE] Found device: {device.address}")
        try:
            async with BleakClient(device.address, disconnected_callback=lambda _: log.warning("[BLE] Disconnected")) as client:
                ble_client = client
                log.info("[BLE] Connected")

                # Notify server.js of BLE status
                await ws_send({"type": "ble_status", "connected": True, "device": device.address})

                await client.start_notify(TX_CHAR_UUID, on_ble_notify)
                log.info("[BLE] Subscribed to TX notifications")

                # Keep alive until disconnected
                while client.is_connected:
                    await asyncio.sleep(1.0)

        except Exception as e:
            log.warning(f"[BLE] Error: {e}")
        finally:
            ble_client = None
            await ws_send({"type": "ble_status", "connected": False})
            log.info(f"[BLE] Retrying in {BLE_RETRY_S}s…")
            await asyncio.sleep(BLE_RETRY_S)


# ── Entry point ───────────────────────────────────────────────────────────────
async def main():
    log.info("=" * 48)
    log.info("  TremorSpoon BLE Bridge v1.0")
    log.info(f"  WebSocket target: {WS_URI}")
    log.info(f"  BLE device:       {DEVICE_NAME}")
    log.info("=" * 48)

    # Run WebSocket and BLE loops concurrently
    await asyncio.gather(
        ws_loop(),
        ble_loop(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Bridge stopped.")
        sys.exit(0)
