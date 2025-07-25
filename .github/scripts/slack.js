import { WebClient } from '@slack/web-api';
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

async function getSlackChannelId(
  channelName,
  cursor,
) {
  const response = await slack.conversations.list({
    cursor,
    limit: 9999,
    exclude_archived: true,
  });

  const maybeChannelId = response.channels?.find(
    channel => channel.name === channelName,
  )?.id;
  const nextCursor = response.response_metadata?.next_cursor;
  if (!maybeChannelId && nextCursor) {
    return await getSlackChannelId(channelName, nextCursor);
  }

  return maybeChannelId;
}

export async function getExistingSlackMessage({ version, channelName }) {
  const channelId = await getSlackChannelId(channelName);
  if (!channelId) {
    throw new Error(`Could not find channel ${channelName}`);
  }

  const response = await slack.conversations.history({
    channel: channelId,
  });

  const existingMessage = response.messages?.find(
    message => message.text?.includes(getReleaseTitle(version)),
  );

  if (!existingMessage) {
    return null;
  }

  return {
    id: existingMessage.ts ?? '',
    body: existingMessage.text ?? '',
  };
}

export async function sendSlackReply({ channelName, message, messageId, broadcast }) {
  const channelId = await getSlackChannelId(channelName);
  if (!channelId) {
    throw new Error(`Could not find channel ${channelName}`);
  }

  return slack.chat.postMessage({
    channel: channelId,
    text: message,
    thread_ts: String(messageId), // if this is empty it should post in the channel
    reply_broadcast: !!broadcast,
  });
}

export async function addSlackReaction({ channelName, messageId, emoji }) {
  const channelId = await getSlackChannelId(channelName);
  if (!channelId) {
    console.error(`Could not find channel ${channelName}`);
    return;
  }

  return slack.reactions.add({
    channel: channelId,
    name: emoji,
    timestamp: messageId,
  }).catch(console.warn);
}

export async function removeSlackReaction({ channelName, messageId, emoji }) {
  const channelId = await getSlackChannelId(channelName);
  if (!channelId) {
    console.error(`Could not find channel ${channelName}`);
    return;
  }

  return slack.reactions.remove({
    channel: channelId,
    name: emoji,
    timestamp: messageId,
  }).catch(console.warn);
}

const getGenericVersion = (versionString) => {
  // turn v0.88.0 into 88.0
  return versionString.replace(/v[01]\./, "");
};

const getReleaseTitle = (version) =>
  `:rocket: *${getGenericVersion(version)} Release* :rocket:`;
