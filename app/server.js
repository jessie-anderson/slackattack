/* Author: Jessie Anderson
   Date: July 12, 2016
*/

import botkit from 'botkit';
require('dotenv').config();
const Yelp = require('yelp');

// yelp tool
const yelp = new Yelp({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  token: process.env.TOKEN,
  token_secret: process.env.TOKEN_SECRET,
});

const iWantFood = ['hungry', 'food', 'restaurant', 'eat', 'dinner', 'breakfast', 'lunch'];
const helpMessage = 'I can say hello to you and help you find food.';

function askFoodLocation(response, convo, bot) {
  convo.say('Great!');
  convo.ask('What kind of food would you like?', (response2, convo2) => {
    const food = response.text;
    convo.ask('Where are you located?', (response3, convo3) => {
      const location = response.text;
      convo.next();
      convo.say(`So, you're looking for ${food} in ${location}.`);
      convo.say('Let me see what I can find for you.');
      yelpIt(food, location, response, convo, bot);
      convo.next();
    });
    convo.next();
  });
}

function searchAgain(response, convo, bot) {
  convo.say('I\'m sorry, I couldn\'t find anything that matched your criteria.');
  convo.ask('Would you like to search for something else?', [
    {
      pattern: bot.utterances.yes,
      callback: (response, convo) => {
        askFoodLocation(response, convo);
        convo.next();
      },
    },
    {
      pattern: bot.utterances.no,
      callback: (response, convo) => {
        convo.say('All right, let me know if you need anything else!');
        convo.next();
      },
    },
    {
      default: true,
      callback: (response, convo) => {
        convo.say('Sorry, I didn\'t understand your response.');
        convo.repeat();
        convo.next();
      },
    },
  ]);
  convo.next();
}

function yelpIt(food, place, response, convo, bot) {
  yelp.search({ term: food, location: place })
  .then((data) => {
    if (data.businesses.length === 0) {
      console.log('no businesses\n');
      searchAgain(response, convo, bot);
    }
    else {
      convo.say('Here\'s what I found:');
      data.businesses.forEach(business => {
        const businessName = business.name;
        let businessRating = business.rating;
        businessRating = `Rating: ${businessRating}`;
        const businessImage = business.image_url;
        const businessInfo = {
          attachments: [
            {
              fallback: 'business info',
              title: businessName,
              text: businessRating,
              image_url: businessImage,
            },
          ],
        };
        convo.say(businessInfo);
        convo.next();
      });
    }
  },
  (reason) => {
    console.log('error\n');
    searchAgain(response, convo, bot);
  });
}

// botkit controller
const controller = botkit.slackbot({
  debug: false,
});

// initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM(err => {
  // start the real time message client
  if (err) { throw new Error(err); }
});

// prepare webhook
// for now we won't use this but feel free to look up slack webhooks
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});

// response to food query
controller.hears(iWantFood, ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.startConversation(message, (err, convo) => {
        convo.ask('Would you like some food recommendations near you?', [
          {
            pattern: bot.utterances.yes,
            callback: (response, convo) => {
              askFoodLocation(response, convo, bot);
              convo.next();
            },
          },
          {
            pattern: bot.utterances.no,
            callback: (response, convo) => {
              convo.say('Then don\'t tell me you\'re hungry!');
              convo.next();
            },
          },
          {
            default: true,
            callback: (response, convo) => {
              convo.say('I\'m sorry, I didn\'t understand your response.');
              convo.repeat();
              convo.next();
            },
          },
        ]);
        convo.next();
      });
    }
  });
});

// response to greeting
controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

controller.hears(['help'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.reply(message, helpMessage);
});

controller.on('outgoing_webhook', (bot, message) => {
  const wakeUpReply = {
    text: 'fine FINE I\'m here!',
    attachments: [
      {
        fallback: 'wake up reply',
        image_url: 'https://giphy.com/gifs/funny-dog-13k2kjI5WKG05W',
      },
    ],
  };
  bot.replyPublic(message, wakeUpReply);
});

controller.on(['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.reply(message, 'I\'m sorry; I don\'t understand that message.');
});
