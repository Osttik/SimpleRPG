import { Builder } from 'flatbuffers';
import { InitMessage } from './generated/simple-rpg/init-message.js';
import { EntityInit } from './generated/simple-rpg/entity-init.js';
import { TileEntry } from './generated/simple-rpg/tile-entry.js';
import type { InitEntity, InitTile } from './types.js';

export const MSG_INIT = 0x10;

export function buildInitMessage(
  playerId: number,
  entities: InitEntity[],
  tileRegistry: InitTile[],
): Uint8Array {
  const builder = new Builder(4096);

  const entityOffsets = entities.map((entity) => {
    const typeStr = builder.createString(entity.type);
    EntityInit.startEntityInit(builder);
    EntityInit.addId(builder, entity.id);
    EntityInit.addX(builder, entity.x);
    EntityInit.addY(builder, entity.y);
    EntityInit.addEntityType(builder, typeStr);
    EntityInit.addFocusedId(builder, entity.focusedId);
    return EntityInit.endEntityInit(builder);
  });
  const entitiesVec = InitMessage.createEntitiesVector(builder, entityOffsets);

  const tileOffsets = tileRegistry.map((tile) => {
    const nameStr = builder.createString(tile.name);
    TileEntry.startTileEntry(builder);
    TileEntry.addId(builder, tile.id);
    TileEntry.addName(builder, nameStr);
    return TileEntry.endTileEntry(builder);
  });
  const tilesVec = InitMessage.createTileRegistryVector(builder, tileOffsets);

  InitMessage.startInitMessage(builder);
  InitMessage.addPlayerId(builder, playerId);
  InitMessage.addEntities(builder, entitiesVec);
  InitMessage.addTileRegistry(builder, tilesVec);
  const msgOffset = InitMessage.endInitMessage(builder);
  builder.finish(msgOffset);

  const fbBytes = builder.asUint8Array();
  const framed = new Uint8Array(1 + fbBytes.length);
  framed[0] = MSG_INIT;
  framed.set(fbBytes, 1);
  return framed;
}
