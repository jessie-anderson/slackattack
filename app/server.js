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

// constants
const iWantFood = ['hungry', 'food', 'restaurant', 'eat', 'dinner', 'breakfast', 'lunch'];
const helpMessage = 'I can wake up on command, say hello to you, and help you find food.';

// helper function
function askFoodLocation(response, convo, bot) {
  convo.say('Great!');
  convo.ask('What kind of food would you like?', (response2, convo2) => {
    // Save responses to food/ location question
    const food = response2.text;
    convo2.ask('Where are you located?', (response3, convo3) => {
      const location = response3.text;
      convo3.next();
      convo3.say(`So, you're looking for ${food} in ${location}.`);
      convo3.say('Let me see what I can find for you.');

      // use yelp!
      yelpIt(food, location, response, convo, bot);
      convo3.next();
    });
    convo2.next();
  });
}

// helper function, called if initial search returned no results
function searchAgain(response, convo, bot) {
  convo.say('I\'m sorry, I couldn\'t find anything that matched your criteria.');
  convo.ask('Would you like to search for something else?', [
    {
      // if the user wants to, the bot will ask for search criteria again
      pattern: bot.utterances.yes,
      callback: (response2, convo2) => {
        askFoodLocation(response2, convo2);
        convo2.next();
      },
    },
    {
      // if the user doesn't want another search, the bot stops talking
      pattern: bot.utterances.no,
      callback: (response2, convo2) => {
        convo2.say('All right, let me know if you need anything else!');
        convo2.next();
      },
    },
    {
      // if the bot doesn't understand, it prompts the user again
      default: true,
      callback: (response2, convo2) => {
        convo2.say('Sorry, I didn\'t understand your response.');
        convo.repeat();
        convo2.next();
      },
    },
  ]);
  convo.next();
}

// the yelp tool in action!
function yelpIt(food, place, response, convo, bot) {
  yelp.search({ term: food, location: place })
  .then((data) => {
    // If there are no businesses in business array, prompt user to search again
    if (data.businesses.length === 0) {
      console.log('no businesses\n');
      searchAgain(response, convo, bot);
    } else {
      // list businesses using attachments
      convo.say('Here\'s what I found:');
      data.businesses.forEach(business => {
        const businessName = business.name;
        let businessRating = business.rating;
        businessRating = `Rating: ${businessRating}`;
        const businessImage = business.image_url;
        // attachment
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
    // If there's an error, prompt user to enter different search criteria
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
            // if yes, initialize search
            pattern: bot.utterances.yes,
            callback: (response, convo2) => {
              askFoodLocation(response, convo2, bot);
              convo2.next();
            },
          },
          {
            // if no, give a sassy response
            pattern: bot.utterances.no,
            callback: (response, convo2) => {
              convo2.say('Then don\'t tell me you\'re hungry!');
              convo2.next();
            },
          },
          {
            // if the bot doesn't understand, prompt user again
            default: true,
            callback: (response, convo2) => {
              convo2.say('I\'m sorry, I didn\'t understand your response.');
              convo2.repeat();
              convo2.next();
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

// help message
controller.hears(['help'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.reply(message, helpMessage);
});

// response to webhook
controller.on('outgoing_webhook', (bot, message) => {
  const wakeUpReply = {
    attachments: [
      {
        fallback: 'wake up reply',
        text: 'fine FINE I\'m here!',
        image_url: 'https://giphy.com/gifs/funny-dog-13k2kjI5WKG05W',
      },
    ],
  };
  bot.replyPublic(message, wakeUpReply);
});

// default response to message bot doesn't understand
controller.on(['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.reply(message, 'I\'m sorry; I don\'t understand that message.');
});
