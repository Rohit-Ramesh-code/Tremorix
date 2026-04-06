#include <Wire.h>
#include <ESP32Servo.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define MPU_ADDR 0x68

#define SERVICE_UUID  "12345678-1234-1234-1234-123456789abc"
#define TX_CHAR_UUID  "abcdef01-1234-1234-1234-123456789abc"  
#define RX_CHAR_UUID  "abcdef02-1234-1234-1234-123456789abc"  

BLECharacteristic* txChar = nullptr;
bool bleConnected = false;

class ServerCB : public BLEServerCallbacks {
  void onConnect(BLEServer*)    override { bleConnected = true;  Serial.println("[BLE] Connected"); }
  void onDisconnect(BLEServer* s) override {
    bleConnected = false;
    Serial.println("[BLE] Disconnected — re-advertising");
    s->startAdvertising();
  }
};


Servo servoPitch;
Servo servoRoll;

int16_t accX, accY, accZ;
int16_t gyroX, gyroY, gyroZ;
float pitch = 0, roll = 0;
float gyroPitch = 0, gyroRoll = 0;
float smoothPitch = 0, smoothRoll = 0;
float lastPitchServo = 90;
float lastRollServo = 90;
int center = 90;
float alpha = 0.98;
float smoothing = 0.85; 
float gyroGain = 0.6;   
float dt = 0.01;         
// y axis - pitch - 19
// x axis - roll - 18

void setup() {
  Serial.begin(115200);
  ESP32PWM::allocateTimer(0);

  servoPitch.setPeriodHertz(50);
  servoPitch.attach(19, 500, 2400);

  servoRoll.setPeriodHertz(50);
  servoRoll.attach(18, 500, 2400);

  servoPitch.write(center);
  servoRoll.write(center);
  Wire.begin(21, 22);
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);
  delay(100);

  BLEDevice::init("TremorSpoon");
  BLEServer* pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCB());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  txChar = pService->createCharacteristic(TX_CHAR_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txChar->addDescriptor(new BLE2902());


  BLECharacteristic* rxChar = pService->createCharacteristic(
    RX_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );

  pService->start();
  BLEDevice::getAdvertising()->addServiceUUID(SERVICE_UUID);
  BLEDevice::getAdvertising()->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("[BLE] Advertising as 'TremorSpoon'");
}

uint32_t loopCount = 0;

void loop() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);
  accX = Wire.read() << 8 | Wire.read();
  accY = Wire.read() << 8 | Wire.read();
  accZ = Wire.read() << 8 | Wire.read();

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x43);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 4, true);
  gyroX = Wire.read() << 8 | Wire.read();
  gyroY = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read();

  float pitchAcc = atan2(accX, sqrt(accY*accY + accZ*accZ)) * 180 / PI;
  float rollAcc  = atan2(accY, sqrt(accX*accX + accZ*accZ)) * 180 / PI;

  float gyroPitchRate = gyroX / 131.0; 
  float gyroRollRate  = gyroY / 131.0;

  pitch = alpha * (pitch + gyroPitchRate * dt) + (1 - alpha) * pitchAcc;
  roll  = alpha * (roll  + gyroRollRate  * dt) + (1 - alpha) * rollAcc;

  float pitchServo = center - pitch + gyroPitchRate * gyroGain;
  float rollServo  = center + roll  - gyroRollRate  * gyroGain;

  pitchServo = smoothing * lastPitchServo + (1 - smoothing) * pitchServo;
  rollServo  = smoothing * lastRollServo  + (1 - smoothing) * rollServo;

  lastPitchServo = pitchServo;
  lastRollServo  = rollServo;

  pitchServo = constrain(pitchServo, 20, 140);
  rollServo  = constrain(rollServo, 20, 160);

  servoPitch.write(pitchServo);
  servoRoll.write(rollServo);

  Serial.print("Pitch: "); Serial.print(pitch);
  Serial.print(" | Roll: "); Serial.print(roll);
  Serial.print(" | SP: "); Serial.print(pitchServo);
  Serial.print(" | SR: "); Serial.println(rollServo);

  loopCount++;
  if (bleConnected && loopCount % 10 == 0) {
    char buf[80];
    snprintf(buf, sizeof(buf),
      "{\"p\":%.1f,\"r\":%.1f,\"ps\":%d,\"rs\":%d}",
      pitch, roll, (int)pitchServo, (int)rollServo
    );
    txChar->setValue(buf);
    txChar->notify();
  }


  delay(20);
}

  
