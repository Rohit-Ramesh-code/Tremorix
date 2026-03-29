
//   ADAPTIVE TREMOR-CANCELLING SPOON — ESP32 FIRMWARE
//   Hardware: ESP32 + MPU6050 + 2x MG90S Micro Servos

//   MODES (auto-set from web server report, or manual override):
//     LOW   — gentle smoothing, responsive. Tremor <2 Hz band
//     MILD  — moderate compensation. Tremor 2–5 Hz
//     HIGH  — aggressive cancellation. Tremor 5–12 Hz

//   BLE Services:
//     TX (notify)  → streams sensor + servo data to PC bridge
//     RX (write)   → receives mode commands from PC bridge

//   Axes:
//     Pitch (Y-axis) → Servo on GPIO 19
//     Roll  (X-axis) → Servo on GPIO 18

#include <Wire.h>
#include <ESP32Servo.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <math.h>
#define MPU_ADDR              0x68
#define MPU_SDA               21
#define MPU_SCL               22
#define GYRO_SCALE            131.0f   
#define ACC_SCALE             16384.0f 
#define SERVO_PITCH_PIN       19
#define SERVO_ROLL_PIN        18
#define SERVO_MIN_US          500
#define SERVO_MAX_US          2400
#define SERVO_CENTER          90
#define SERVO_LIMIT_LOW       20
#define SERVO_LIMIT_HIGH      160
#define SERVICE_UUID          "12345678-1234-1234-1234-123456789abc"
#define TX_CHAR_UUID          "abcdef01-1234-1234-1234-123456789abc"  
#define RX_CHAR_UUID          "abcdef02-1234-1234-1234-123456789abc"  
#define LOOP_HZ               100
#define DT                    (1.0f / LOOP_HZ)
#define BLE_SEND_EVERY_N      10    
typedef enum { MODE_LOW = 0, MODE_MILD = 1, MODE_HIGH = 2 } TremorMode;

struct ModeConfig {
  float alpha;        
  float smoothing;    
  float gyroGain;     
  float maxRate;      
  const char* label;
};
const ModeConfig MODES[3] = {
  { 0.90f, 0.70f, 0.4f, 80.0f,  "LOW"  },
  { 0.93f, 0.80f, 0.8f, 120.0f, "MILD" },
  { 0.97f, 0.88f, 1.2f, 200.0f, "HIGH" }
};

Servo servoPitch, servoRoll;

int16_t rawAccX, rawAccY, rawAccZ;
int16_t rawGyroX, rawGyroY;

float pitch       = 0.0f, roll        = 0.0f;
float lastPServo  = SERVO_CENTER, lastRServo = SERVO_CENTER;

float gyroBiasX   = 0.0f, gyroBiasY = 0.0f;
float prevPitchRate = 0.0f, prevRollRate = 0.0f;
uint32_t zeroCrossCount = 0;
uint32_t zcWindowMs     = 0;

TremorMode currentMode  = MODE_MILD; 
bool bleConnected       = false;
uint32_t loopCount      = 0;

BLECharacteristic* txChar = nullptr;
BLECharacteristic* rxChar = nullptr;

void calibrateGyro();

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    bleConnected = true;
    Serial.println("[BLE] Client connected");
  }
  void onDisconnect(BLEServer* pServer) override {
    bleConnected = false;
    Serial.println("[BLE] Client disconnected — restarting advertising");
    pServer->startAdvertising();
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String val = pChar->getValue().c_str();
    if (val.length() == 0) return;

    StaticJsonDocument<128> doc;
    DeserializationError err = deserializeJson(doc, val);
    if (err) {
      Serial.print("[RX] JSON parse error: "); Serial.println(err.c_str());
      return;
    }

    const char* cmd = doc["cmd"];
    if (!cmd) return;

    if (strcmp(cmd, "set_mode") == 0) {
      const char* m = doc["mode"];
      if      (strcmp(m, "LOW")  == 0) currentMode = MODE_LOW;
      else if (strcmp(m, "MILD") == 0) currentMode = MODE_MILD;
      else if (strcmp(m, "HIGH") == 0) currentMode = MODE_HIGH;
      Serial.printf("[RX] Mode → %s\n", MODES[currentMode].label);
    }
    else if (strcmp(cmd, "calibrate") == 0) {
      calibrateGyro();
    }
  }
};

void calibrateGyro() {
  Serial.println("[CAL] Calibrating gyro — keep device still...");
  long sx = 0, sy = 0;
  const int N = 200;
  for (int i = 0; i < N; i++) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x43);
    Wire.endTransmission(false);
    Wire.requestFrom(MPU_ADDR, 4, true);
    int16_t gx = Wire.read() << 8 | Wire.read();
    int16_t gy = Wire.read() << 8 | Wire.read();
    sx += gx; sy += gy;
    delay(5);
  }
  gyroBiasX = sx / (float)N;
  gyroBiasY = sy / (float)N;
  Serial.printf("[CAL] Done. Bias X=%.2f Y=%.2f LSB\n", gyroBiasX, gyroBiasY);
}

void readMPU() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 14, true);  

  rawAccX  = Wire.read() << 8 | Wire.read();
  rawAccY  = Wire.read() << 8 | Wire.read();
  rawAccZ  = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read();             
  rawGyroX = Wire.read() << 8 | Wire.read();
  rawGyroY = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read();              
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== Tremor-Cancelling Spoon v2.0 ===");
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoPitch.setPeriodHertz(50);
  servoRoll.setPeriodHertz(50);
  servoPitch.attach(SERVO_PITCH_PIN, SERVO_MIN_US, SERVO_MAX_US);
  servoRoll.attach(SERVO_ROLL_PIN,   SERVO_MIN_US, SERVO_MAX_US);
  servoPitch.write(SERVO_CENTER);
  servoRoll.write(SERVO_CENTER);
  Serial.println("[SERVO] Initialized at center");
  Wire.begin(MPU_SDA, MPU_SCL);
  Wire.setClock(400000); 
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); Wire.write(0x00);   
  Wire.endTransmission(true);
  delay(50);
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1B); Wire.write(0x00);   
  Wire.endTransmission(true);
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1C); Wire.write(0x00);   
  Wire.endTransmission(true);
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1A); Wire.write(0x03);   
  Wire.endTransmission(true);
  Serial.println("[MPU] Initialized");

  delay(500);
  calibrateGyro();

  readMPU();
  float ax = rawAccX / ACC_SCALE;
  float ay = rawAccY / ACC_SCALE;
  float az = rawAccZ / ACC_SCALE;
  pitch = atan2f(ax, sqrtf(ay*ay + az*az)) * 180.0f / PI;
  roll  = atan2f(ay, sqrtf(ax*ax + az*az)) * 180.0f / PI;

  BLEDevice::init("TremorSpoon");
  BLEServer* pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  txChar = pService->createCharacteristic(
    TX_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  txChar->addDescriptor(new BLE2902());

  rxChar = pService->createCharacteristic(
    RX_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  rxChar->setCallbacks(new RxCallbacks());

  pService->start();

  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Advertising as 'TremorSpoon'");
  Serial.println("[READY] Entering control loop...\n");

  zcWindowMs = millis();
}

void loop() {
  uint32_t loopStart = micros();

  readMPU();

  const ModeConfig& cfg = MODES[currentMode];

  float ax = rawAccX / ACC_SCALE;
  float ay = rawAccY / ACC_SCALE;
  float az = rawAccZ / ACC_SCALE;
  float pitchAcc = atan2f(ax, sqrtf(ay*ay + az*az)) * 180.0f / PI;
  float rollAcc  = atan2f(ay, sqrtf(ax*ax + az*az)) * 180.0f / PI;


  float gyroRateX = (rawGyroX - gyroBiasX) / GYRO_SCALE;
  float gyroRateY = (rawGyroY - gyroBiasY) / GYRO_SCALE;


  gyroRateX = constrain(gyroRateX, -cfg.maxRate, cfg.maxRate);
  gyroRateY = constrain(gyroRateY, -cfg.maxRate, cfg.maxRate);

  pitch = cfg.alpha * (pitch + gyroRateX * DT) + (1.0f - cfg.alpha) * pitchAcc;
  roll  = cfg.alpha * (roll  + gyroRateY * DT) + (1.0f - cfg.alpha) * rollAcc;

  float pitchTarget = (float)SERVO_CENTER + pitch - gyroRateX * cfg.gyroGain;
  float rollTarget  = (float)SERVO_CENTER + roll  - gyroRateY * cfg.gyroGain;


  float pitchServo = cfg.smoothing * lastPServo + (1.0f - cfg.smoothing) * pitchTarget;
  float rollServo  = cfg.smoothing * lastRServo  + (1.0f - cfg.smoothing) * rollTarget;
  lastPServo = pitchServo;
  lastRServo = rollServo;

  pitchServo = constrain(pitchServo, SERVO_LIMIT_LOW, SERVO_LIMIT_HIGH);
  rollServo  = constrain(rollServo,  SERVO_LIMIT_LOW, SERVO_LIMIT_HIGH);

  servoPitch.write((int)pitchServo);
  servoRoll.write((int)rollServo);

  if ((gyroRateX > 0) != (prevPitchRate > 0) && fabs(gyroRateX) > 2.0f) {
    zeroCrossCount++;
  }
  prevPitchRate = gyroRateX;
  prevRollRate  = gyroRateY;

  loopCount++;
  if (bleConnected && (loopCount % BLE_SEND_EVERY_N == 0)) {
    uint32_t now = millis();
    float windowSec = (now - zcWindowMs) / 1000.0f;
    float tremorHz  = (windowSec > 0) ? (zeroCrossCount / 2.0f / windowSec) : 0.0f;
    zeroCrossCount  = 0;
    zcWindowMs      = now;

    StaticJsonDocument<200> doc;
    doc["ts"]   = now;            
    doc["p"]    = roundf(pitch  * 10) / 10.0f;
    doc["r"]    = roundf(roll   * 10) / 10.0f;
    doc["gx"]   = roundf(gyroRateX * 10) / 10.0f;
    doc["gy"]   = roundf(gyroRateY * 10) / 10.0f;
    doc["ps"]   = (int)pitchServo;
    doc["rs"]   = (int)rollServo;
    doc["hz"]   = roundf(tremorHz * 10) / 10.0f;
    doc["mode"] = MODES[currentMode].label;

    char buf[200];
    serializeJson(doc, buf);
    txChar->setValue(buf);
    txChar->notify();
  }

  if (loopCount % 200 == 0) {
    Serial.printf("[%s] P:%.1f R:%.1f | SP:%d SR:%d | GX:%.1f GY:%.1f | BLE:%s\n",
      MODES[currentMode].label,
      pitch, roll,
      (int)pitchServo, (int)rollServo,
      gyroRateX, gyroRateY,
      bleConnected ? "ON" : "OFF"
    );
  }

  uint32_t elapsed = micros() - loopStart;
  uint32_t targetUs = 1000000 / LOOP_HZ;
  if (elapsed < targetUs) {
    delayMicroseconds(targetUs - elapsed);
  }
}


