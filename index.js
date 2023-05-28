const Conversation = require('./Classes/Conversation')
const ChatGPT = require('./Classes/ChatGPT')
const ChatGPTSummarizer = require('./Classes/ChatGPTSummarizer')

require('dotenv').config()

//Prepare to connect to the Discord APi
const { Client, GatewayIntentBits, Partials } = require('discord.js')

const discordClient = new Client({intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
], partials: [Partials.Channel]
})

var defaultLanguage = "EN";
var conversations = {};
var chatGPT = new ChatGPT(process.env.OPENAI_ORGANIZATION, process.env.OPENAI_KEY);
var chatGPTSummarizer = new ChatGPTSummarizer(process.env.OPENAI_ORGANIZATION, process.env.OPENAI_KEY);

discordClient.on('messageCreate', async function(discordMessage){
    let userName = discordMessage.author.username;
    
    try{
        let messageContent = preProcessMessage(discordMessage)
        if( !messageContent ) 
            return;        

        const userConversation = getUserConversation(userName, discordMessage.channel.id, messageContent);

        // process any user commands if needed
        let commandResponse = detectUserAndProcessMessageCommands(userConversation, messageContent);
        if( commandResponse) // if a command returns something, reply as a message and returns
        {
            discordMessage.reply(commandResponse);
            return;
        }

        await discordMessage.channel.sendTyping(); // show users the bot is typing

        if( messageContent.startsWith("\\summarize"))
        {
            if( discordMessage.attachments.size > 0)
            {
                chatGPTSummarizer.summarizeMessageAttachments(userConversation.getUserPreferredLanguage(), 
                                                              discordMessage);
                return;
            }
            else
            {
                discordMessage.reply(`No attachments found`);
            }
        }
        
        userConversation.appendMessage('user', messageContent);

        const result = await chatGPT.createCompletion(userConversation);
        if( result.success )
        {
            // discord messagens cannot exceed 2000 characters, so we have to split the messagens in chunks of 2000 characters or less.
            let responseChunks = result.responseMsg.match(/(.|[\r\n]){1,1999}/g);
            let i=0;
            do{
                let msg = responseChunks[i];
                if( i == (responseChunks.length-1))
                    discordMessage.reply(`${msg}\n(Conversation Tokens=${userConversation.getCurrentConversationTokens()})`);
                else
                    discordMessage.reply(msg);

                i++;
            } while (i<responseChunks.length);
        }
        else
        {
            discordMessage.reply(`OpenApi error: ${result.statusText}.Error Content: ${result.data}`);
        }
    }
    catch(err)
    {
        console.log("There was an unknown error. Error = " + err.message + "\r\n" + err.stack);

        discordMessage.reply("There was an unknown error. Error = " + err);
    }

})


function preProcessMessage(discordMessage)
{
    if( discordMessage.author.bot) 
        return null;

    let messageContent = discordMessage.content.trim();
      
    let botIsInMentions = discordMessage.mentions.has(discordClient.user);
    if( botIsInMentions)
        messageContent = discordMessage.content.replace(/<@!?(\d+)>/g, "").trim(); // remove mention prefix from message

    let botIsMentionedByName = messageContent.toLowerCase().startsWith("rob:") || // is bot mentioned by name?
                               messageContent.toLowerCase().startsWith("rob,");

    if( botIsMentionedByName )
        messageContent = messageContent.substring(4).trim();

    if( messageContent.startsWith("\\") ) // it is a command?
        return messageContent;

    let isPrivateChannel = discordMessage.channel.type === 1 || // detect if the channel is private with the bot
                           discordMessage.channel.members.size === 2; // that are just the bot and another user in the channel

    if( !botIsMentionedByName && !botIsInMentions && !isPrivateChannel) // return if message is not directed to the bot.
        return null;

    return messageContent;
}


function getUserConversation(userName, channelId, messageContent)
{
    var conversationKey = userName + "_" + channelId;

    if( isHello(messageContent)) // if is Hello, user is asking to reset everything and initialize a new subject
    {
        const language = detectLanguageFromHello(messageContent);
        conversations[conversationKey] = new Conversation(userName, 
                                                   language, 
                                                   process.env.MAX_USER_CONVERSATION_CHARS,
                                                   parseInt(process.env.TOKENS_TO_RESERVE_FOR_COMPLETION));
        return conversations[conversationKey];
    }

    const existingConversation = conversations[conversationKey];
    if( !existingConversation)
    {
        conversations[conversationKey] = new Conversation(userName, defaultLanguage, process.env.MAX_USER_CONVERSATION_CHARS);
        return conversations[conversationKey];
    }
    return existingConversation;
}

function detectUserAndProcessMessageCommands(userConversation, messageContent)
{
    let msg = messageContent.trim().toLowerCase();
    
    if( isHello(msg))
    {
        if( detectLanguageFromHello(msg) == "PT")
            return `Olá.\nSou o Rob. Sou um robô especialista nos mais variados assuntos.\nComo posso te ajudar?`;
        
        return `Hi.\nI'm Rob. I'm a friendly robot.\nHow can I help you?`;
    }

    if( msg.startsWith("\\"))  // it is a command message
        msg = msg.substring(1); // removes the command character
    else
        if( msg.startsWith("?")) // it start with a ? ignores all and show the help instructions
            msg = "?";
        else
            return null

    let capturePattern=/change\s+model\s+to\s+(?<model>turbo|ada|davinci|curie|babbage|codex)/;
    let patternFound = msg.match(capturePattern);
    if( patternFound )
    {
        if( patternFound.groups.model.trim() == 'davinci')
            userConversation.setResponseModel('text-davinci-003');
        else
        if( patternFound.groups.model.trim() == 'ada')
            userConversation.setResponseModel('text-ada-001');
        else
        if( patternFound.groups.model.trim() == 'curie')
            userConversation.setResponseModel('text-curie-001');
        else
        if( patternFound.groups.model.trim() == 'babbage')
            userConversation.setResponseModel('text-babbage-001');
        else
        if( patternFound.groups.model.trim() == 'codex')
            userConversation.setResponseModel('code-davinci-002');
        else
        if( patternFound.groups.model.trim() == 'turbo')
            userConversation.setResponseModel('gpt-3.5-turbo');
        else
        if( patternFound.groups.model.trim() == 'gpt4')
            userConversation.setResponseModel('gpt-3.5-turbo');
        else
            userConversation.setResponseModel('gpt-3.5-turbo');
    
        return `Model changed to **${userConversation.getResponseModel()}**`;
    }

    capturePattern=/change\s+temp\s+to\s+(?<temp>\d+(.\d{1})*)/;
    patternFound = msg.match(capturePattern);
    if( patternFound )
    {
        try
        {
            const newTemp = parseFloat(patternFound.groups.temp);
            if( newTemp>=0 && newTemp<=1)
            {
                const oldTemp = userConversation.getTemperature();
                userConversation.setTemperature(newTemp);
                return `Temperature changed from ${oldTemp} to **${userConversation.getTemperature()}**`;
            }
            else
                return 'Temperature must be between 0.0 and 1.0';
        }
        catch(err)
        {
            return 'Temperature must be between 0.0 and 1.0';
        }
    }

    if( msg === "??" || msg === "show conversation params")
    {
        return `Conversation params:
Model = **${userConversation.responseModel}**
Temperature = **${userConversation.temperature}**
Prefered Language = **${userConversation.preferredLanguage}**
        `;
    }

    if( msg === "?" )
    {
        return `**Possible commands:**

- **?** shows this.

- **Hi** or **Oi** : clear all chat history and resets model to the default gpt-3.5-turbo
    **Hi** or **Hello** resets to English as the preferred language
    **Oi** or **olá** resets to Portuguese as the preferred language

- **\\change model to <model>** : changes the chatGPT model used for the conversation.
    <model> can be one of: turbo, ada, davinci, curie, babbage, codex
    Example: \\change model to davinci

- **\\change temp to <temp>** : changes the temperature of the model
    <temp> must be between 0.0 and 1.0
    Example: \\change temp to 0.5

- **\\??** or \\show conversation params**: shows the current conversation params
`
    }

    if( userConversation.getUserPreferredLanguage() == "PT")
        return "Comando não reconhecido";

    return "Command not recognized";
}

let hellos = {
    EN : ["hi", "hello"],
    PT : ["olá", "ola", "oi"]
}

function isHello(msg)
{
	let result = false;
    Object.keys(hellos).forEach(function(key) {
        if( hellos[key].indexOf(msg.trim().toLowerCase()) >=0 )
        {
            result = true;
            return;
        }
    });
    return result;
}

function detectLanguageFromHello(msg)
{
    let result = "EN";
    Object.keys(hellos).forEach(function(key) {
        if( hellos[key].indexOf(msg.trim().toLowerCase()) >=0 )
        {
            result = key;
            return;
        }
    });
    return result;
}

discordClient.login(process.env.DISCORD_TOKEN);
console.log("ChatGPT Bot is online on Discord");

