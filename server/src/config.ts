import * as dotenv from 'dotenv';

dotenv.config();

export const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
export const bindHost = process.env.BIND_HOST || '0.0.0.0';
export const publicHost = process.env.HOST || bindHost;

export const GAME_TICK_RATE = 1000 / 60;
export const TILE_SIZE = 40;
export const CHUNK_PIXEL_SIZE = 16 * TILE_SIZE;
export const GAME_TOPIC = 'game';
