import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { SaveSlotDocument, SaveSlotMetadata, SavedWorldState } from './types.js';

const SAVE_FILE_FORMAT = 'simplerpg.save-slot';
const SAVE_FILE_VERSION = 1;

export class SaveSlotStore {
  constructor(private readonly savesDir: string) {}

  async ensureReady() {
    await fs.mkdir(this.savesDir, { recursive: true });
  }

  async list(): Promise<SaveSlotMetadata[]> {
    await this.ensureReady();
    const names = await fs.readdir(this.savesDir);
    const saves: SaveSlotMetadata[] = [];

    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const filePath = path.join(this.savesDir, name);
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const doc = JSON.parse(raw) as SaveSlotDocument;
        if (doc.format !== SAVE_FILE_FORMAT || doc.version !== SAVE_FILE_VERSION) continue;
        saves.push({
          saveId: doc.saveId,
          displayName: doc.displayName,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          sourceLobbyName: doc.sourceLobbyName,
          version: doc.version,
          worldFormat: doc.world.format,
          worldVersion: doc.world.version,
        });
      } catch (error) {
        console.warn(`Skipping unreadable save slot ${filePath}:`, error);
      }
    }

    saves.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return saves;
  }

  async load(saveId: string): Promise<SaveSlotDocument> {
    await this.ensureReady();
    const filePath = this.filePathFor(saveId);
    const raw = await fs.readFile(filePath, 'utf8');
    const doc = JSON.parse(raw) as SaveSlotDocument;

    if (doc.format !== SAVE_FILE_FORMAT || doc.version !== SAVE_FILE_VERSION) {
      throw new Error(`Unsupported save slot format for ${saveId}`);
    }

    return doc;
  }

  async save(options: {
    saveId?: string;
    displayName: string;
    sourceLobbyName?: string;
    world: SavedWorldState;
  }): Promise<SaveSlotMetadata> {
    await this.ensureReady();

    const existing = options.saveId ? await this.tryLoad(options.saveId) : null;
    const saveId = existing?.saveId ?? options.saveId ?? randomUUID();
    const now = new Date().toISOString();
    const doc: SaveSlotDocument = {
      format: SAVE_FILE_FORMAT,
      version: SAVE_FILE_VERSION,
      saveId,
      displayName: options.displayName.trim() || 'Unnamed Save',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      sourceLobbyName: options.sourceLobbyName?.trim() || existing?.sourceLobbyName,
      world: options.world,
    };

    await fs.writeFile(this.filePathFor(saveId), JSON.stringify(doc, null, 2), 'utf8');
    return {
      saveId: doc.saveId,
      displayName: doc.displayName,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      sourceLobbyName: doc.sourceLobbyName,
      version: doc.version,
      worldFormat: doc.world.format,
      worldVersion: doc.world.version,
    };
  }

  private async tryLoad(saveId: string): Promise<SaveSlotDocument | null> {
    try {
      return await this.load(saveId);
    } catch {
      return null;
    }
  }

  private filePathFor(saveId: string): string {
    return path.join(this.savesDir, `${saveId}.json`);
  }
}
