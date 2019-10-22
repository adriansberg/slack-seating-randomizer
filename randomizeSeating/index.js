const { WebClient } = require('@slack/web-api');
const querystring = require('querystring');
const _ = require('lodash');

const FOOD_EMOJIS = [
  'avocado',
  'hamburger',
  'pizza',
  'hotdog',
  'taco',
  'burrito',
  'sushi',
  'fried_egg',
  'cooking'
];

const client = new WebClient(process.env.TOKEN);

async function getReactions(channel, timestamp) {
  const response = await client.reactions.get({
    channel: channel,
    timestamp: timestamp
  });

  const { reactions } = response.message;

  return reactions ? reactions : [];
}

async function sendMessage(channelId, threadTimestamp, users) {
  return await client.chat.postMessage({
    channel: channelId,
    text: _.shuffle(users).join('\n'),
    as_user: false,
    thread_ts: threadTimestamp,
    username: 'Sitteplasser'
  });
}

async function sendEphemeral(channelId, user) {
  return await client.chat.postEphemeral({
    channel: channelId,
    attachments: [
      {
        fallback: 'Could not randomize seating order. No valid reaction found.',
        color: '#f00',
        pretext: '_Could not randomize seating order_',
        title: 'No valid reaction found',
        text: 'See the list of valid reactions below',
        fields: [
          {
            title: 'Valid reactions',
            value: FOOD_EMOJIS.join(', '),
            short: false
          }
        ]
      }
    ],
    as_user: false,
    user: user
  });
}

async function getUserList() {
  const response = await client.users.list();
  const { members } = response;
  return members ? members : [];
}

async function mapIdsToNames(ids) {
  const userList = await getUserList();

  const usersIdAndName = userList.reduce((obj, user) => {
    obj[user.id] = user.profile.display_name;
    return obj;
  }, []);

  const userNames = ids.reduce((arr, userId) => {
    arr.push(usersIdAndName[userId]);
    return arr;
  }, []);

  return userNames;
}

module.exports = async function(context, req) {
  if (req.headers['content-type'] !== 'application/x-www-form-urlencoded') {
    context.res = { status: 400 };
    return;
  }

  const parsedBody = querystring.parse(req.body);
  const parsedPayload = JSON.parse(parsedBody.payload);

  if (_.isNil(parsedPayload)) {
    context.res = { status: 400 };
    return;
  }

  const { channel, message, user } = parsedPayload;

  const reactions = await getReactions(channel.id, message.ts);
  context.log(reactions);

  const reaction = reactions.find(reaction =>
    FOOD_EMOJIS.includes(reaction.name)
  );

  if (reaction) {
    const userNames = await mapIdsToNames(reaction.users);
    await sendMessage(channel.id, message.ts, userNames);
  } else {
    await sendEphemeral(channel.id, user.id);
  }
};
