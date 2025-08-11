import fs from 'fs-extra';
import path from 'path';

export class FileManager {
  constructor(private outputDir: string) {
    fs.ensureDirSync(this.outputDir);
  }

  async getUniqueFilename(prefix: string, startNumber: number): Promise<string> {
    let counter = startNumber;
    let filename = `${prefix}_${counter}.png`;
    
    while (await this.fileExists(filename)) {
      counter++;
      filename = `${prefix}_${counter}.png`;
    }
    
    return filename;
  }

  async getNextAvailableNumber(prefix: string): Promise<number> {
    const files = await fs.readdir(this.outputDir);
    const pattern = new RegExp(`^${prefix}_(\\d+)\\.png$`);
    let maxNumber = 0;
    
    for (const file of files) {
      const match = file.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }
    
    return maxNumber + 1;
  }

  async fileExists(filename: string): Promise<boolean> {
    const filepath = path.join(this.outputDir, filename);
    return await fs.pathExists(filepath);
  }

  async saveFile(buffer: Buffer, filename: string): Promise<string> {
    const filepath = path.join(this.outputDir, filename);
    await fs.writeFile(filepath, buffer);
    return filepath;
  }

  async deleteFile(filename: string): Promise<void> {
    const filepath = path.join(this.outputDir, filename);
    if (await fs.pathExists(filepath)) {
      await fs.remove(filepath);
    }
  }

  async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
    const files = await fs.readdir(this.outputDir);
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    
    for (const file of files) {
      const filepath = path.join(this.outputDir, file);
      const stats = await fs.stat(filepath);
      
      if (now - stats.mtimeMs > maxAge) {
        await fs.remove(filepath);
      }
    }
  }

  async getFileSize(filename: string): Promise<number> {
    const filepath = path.join(this.outputDir, filename);
    const stats = await fs.stat(filepath);
    return stats.size;
  }
}