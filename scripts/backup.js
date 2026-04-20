/**
 * MongoDB Backup Script
 * Automated Daily Backup with Cloud Upload
 * Usage: node scripts/backup.js [--upload]
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");

const config = {
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/gearbazar",
  backupDir: process.env.BACKUP_DIR || path.join(__dirname, "../backups"),
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 7,
  cloudProvider: process.env.CLOUD_PROVIDER || "local",
  s3Bucket: process.env.S3_BUCKET || "gearbazar-backups",
  s3Region: process.env.S3_REGION || "us-east-1",
  gcsBucket: process.env.GCS_BUCKET || "gearbazar-backups",
  gcsKeyPath: process.env.GCS_KEY_PATH || "",
};

const logger = {
  info: (...args) => console.log("[INFO]", new Date().toISOString(), ...args),
  error: (...args) =>
    console.error("[ERROR]", new Date().toISOString(), ...args),
};

const getTimestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

const createBackupDir = () => {
  if (!fs.existsSync(config.backupDir)) {
    fs.mkdirSync(config.backupDir, { recursive: true });
  }
};

const dumpMongoDB = () => {
  const timestamp = getTimestamp();
  const backupPath = path.join(config.backupDir, `gearbazar_${timestamp}`);

  createBackupDir();

  logger.info("Starting MongoDB dump...");

  const mongoUri = config.mongoUri;
  const dbName = mongoUri.split("/").pop().split("?")[0] || "gearbazar";

  try {
    execSync(`mongodump --uri="${mongoUri}" --out="${backupPath}" --gzip`, {
      stdio: "inherit",
    });

    logger.info(`Backup created at: ${backupPath}`);

    const archivePath = `${backupPath}.archive.gz`;
    execSync(
      `cd "${config.backupDir}" && tar -czf "${path.basename(archivePath)}" "${path.basename(backupPath)}"`,
      {
        stdio: "inherit",
      },
    );

    fs.rmdirSync(backupPath, { recursive: true });

    logger.info(`Archive created: ${archivePath}`);
    return archivePath;
  } catch (error) {
    logger.error("MongoDB dump failed:", error.message);
    throw error;
  }
};

const uploadToS3 = async (archivePath) => {
  const AWS = require("aws-sdk");
  const s3 = new AWS.S3({
    region: config.s3Region,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });

  const fileName = path.basename(archivePath);
  const fileContent = fs.readFileSync(archivePath);

  const params = {
    Bucket: config.s3Bucket,
    Key: `backups/${fileName}`,
    Body: fileContent,
    ContentType: "application/gzip",
  };

  try {
    await s3.upload(params).promise();
    logger.info(`Uploaded to S3: s3://${config.s3Bucket}/backups/${fileName}`);
    return `s3://${config.s3Bucket}/backups/${fileName}`;
  } catch (error) {
    logger.error("S3 upload failed:", error.message);
    throw error;
  }
};

const uploadToGCS = async (archivePath) => {
  const { Storage } = require("@google-cloud/storage");
  const storage = new Storage({ keyFilename: config.gcsKeyPath });

  const bucket = storage.bucket(config.gcsBucket);
  const fileName = path.basename(archivePath);

  try {
    await bucket.upload(archivePath, {
      destination: `backups/${fileName}`,
    });

    logger.info(
      `Uploaded to GCS: gs://${config.gcsBucket}/backups/${fileName}`,
    );
    return `gs://${config.gcsBucket}/backups/${fileName}`;
  } catch (error) {
    logger.error("GCS upload failed:", error.message);
    throw error;
  }
};

const uploadToCloud = async (archivePath) => {
  switch (config.cloudProvider) {
    case "s3":
      return uploadToS3(archivePath);
    case "gcs":
      return uploadToGCS(archivePath);
    case "local":
      logger.info("Local backup - no upload");
      return archivePath;
    default:
      logger.info("No cloud provider configured - local backup only");
      return archivePath;
  }
};

const cleanupOldBackups = () => {
  if (!fs.existsSync(config.backupDir)) return;

  const files = fs
    .readdirSync(config.backupDir)
    .filter((f) => f.endsWith(".archive.gz"))
    .map((f) => ({
      name: f,
      path: path.join(config.backupDir, f),
      mtime: fs.statSync(path.join(config.backupDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length > config.retentionDays) {
    const toDelete = files.slice(config.retentionDays);
    toDelete.forEach((f) => {
      fs.unlinkSync(f.path);
      logger.info(`Deleted old backup: ${f.name}`);
    });
  }
};

const sendBackupNotification = async (cloudPath, size) => {
  const webhookUrl = process.env.BACKUP_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await axios.post(webhookUrl, {
      text: `✅ MongoDB Backup Complete\nDatabase: gearbazar\nSize: ${(size / 1024 / 1024).toFixed(2)} MB\nLocation: ${cloudPath}`,
    });
  } catch (error) {
    logger.error("Webhook notification failed:", error.message);
  }
};

const runBackup = async () => {
  const startTime = Date.now();

  try {
    logger.info("=== Starting MongoDB Backup ===");

    const archivePath = await dumpMongoDB();
    const stats = fs.statSync(archivePath);
    const cloudPath = await uploadToCloud(archivePath);

    cleanupOldBackups();

    await sendBackupNotification(cloudPath, stats.size);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`=== Backup Complete in ${duration}s ===`);

    process.exit(0);
  } catch (error) {
    logger.error("Backup failed:", error.message);
    process.exit(1);
  }
};

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
MongoDB Backup Script
Usage: node backup.js [options]

Options:
  --upload    Upload backup to cloud storage
  --help      Show this help message

Environment Variables:
  MONGODB_URI         MongoDB connection string
  BACKUP_DIR          Local backup directory
  CLOUD_PROVIDER      s3, gcs, or local
  S3_BUCKET           S3 bucket name
  AWS_ACCESS_KEY_ID   AWS access key
  AWS_SECRET_ACCESS_KEY AWS secret key
  GCS_BUCKET          Google Cloud Storage bucket
  GCS_KEY_PATH        Google Cloud key file path
  `);
  process.exit(0);
}

runBackup();
