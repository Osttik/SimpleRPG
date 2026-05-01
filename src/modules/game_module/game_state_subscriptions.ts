import { useCallback, useSyncExternalStore } from 'react';

export const GAME_STATE_TOPICS = [
  'inventory',
  'loot',
  'crafting',
  'combat',
  'animationMetrics',
  'worldLayerDebug',
] as const;

export type GameStateTopic = typeof GAME_STATE_TOPICS[number];

export interface GameStateTopicMetrics {
  version: number;
  publishCount: number;
  notificationCount: number;
  subscriberCount: number;
  lastPublishedAt: number | null;
}

type GameStateListener = () => void;

const topicListeners = new Map<GameStateTopic, Set<GameStateListener>>(
  GAME_STATE_TOPICS.map((topic) => [topic, new Set<GameStateListener>()] as const),
);

const topicMetrics = new Map<GameStateTopic, GameStateTopicMetrics>(
  GAME_STATE_TOPICS.map((topic) => [
    topic,
    {
      version: 0,
      publishCount: 0,
      notificationCount: 0,
      subscriberCount: 0,
      lastPublishedAt: null,
    },
  ] as const),
);

function normalizeTopics(topics: GameStateTopic | readonly GameStateTopic[]): GameStateTopic[] {
  return [...new Set(Array.isArray(topics) ? topics : [topics])];
}

export function subscribeGameState(
  topics: GameStateTopic | readonly GameStateTopic[],
  listener: GameStateListener,
): () => void {
  const normalizedTopics = normalizeTopics(topics);

  for (const topic of normalizedTopics) {
    const listeners = topicListeners.get(topic);
    listeners?.add(listener);
    const metrics = topicMetrics.get(topic);
    if (metrics && listeners) {
      metrics.subscriberCount = listeners.size;
    }
  }

  return () => {
    for (const topic of normalizedTopics) {
      const listeners = topicListeners.get(topic);
      listeners?.delete(listener);
      const metrics = topicMetrics.get(topic);
      if (metrics && listeners) {
        metrics.subscriberCount = listeners.size;
      }
    }
  };
}

export function publishGameStateUpdate(topics: GameStateTopic | readonly GameStateTopic[]): void {
  const normalizedTopics = normalizeTopics(topics);
  const listenersToNotify = new Set<GameStateListener>();
  const publishedAt = Date.now();

  for (const topic of normalizedTopics) {
    const listeners = topicListeners.get(topic);
    const metrics = topicMetrics.get(topic);

    if (metrics) {
      metrics.version += 1;
      metrics.publishCount += 1;
      metrics.notificationCount += listeners?.size ?? 0;
      metrics.subscriberCount = listeners?.size ?? 0;
      metrics.lastPublishedAt = publishedAt;
    }

    listeners?.forEach((listener) => listenersToNotify.add(listener));
  }

  listenersToNotify.forEach((listener) => listener());
}

export function getGameStateSubscriptionSnapshot(topics: GameStateTopic | readonly GameStateTopic[]): string {
  return normalizeTopics(topics)
    .map((topic) => `${topic}:${topicMetrics.get(topic)?.version ?? 0}`)
    .join('|');
}

export function getGameStateRenderMetrics(): Record<GameStateTopic, GameStateTopicMetrics> {
  return GAME_STATE_TOPICS.reduce((metricsByTopic, topic) => {
    const metrics = topicMetrics.get(topic);
    metricsByTopic[topic] = {
      version: metrics?.version ?? 0,
      publishCount: metrics?.publishCount ?? 0,
      notificationCount: metrics?.notificationCount ?? 0,
      subscriberCount: metrics?.subscriberCount ?? 0,
      lastPublishedAt: metrics?.lastPublishedAt ?? null,
    };
    return metricsByTopic;
  }, {} as Record<GameStateTopic, GameStateTopicMetrics>);
}

export function useGameStateSubscription(topics: GameStateTopic | readonly GameStateTopic[]): string {
  const topicKey = normalizeTopics(topics).join('|');
  const subscribe = useCallback(
    (listener: GameStateListener) => subscribeGameState(topicKey.split('|') as GameStateTopic[], listener),
    [topicKey],
  );
  const getSnapshot = useCallback(
    () => getGameStateSubscriptionSnapshot(topicKey.split('|') as GameStateTopic[]),
    [topicKey],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
