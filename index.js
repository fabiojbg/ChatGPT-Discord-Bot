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

        let channelId = discordMessage.channel.id;

        // process any user commands if needed
        let commandResponse = initConversationAndProcessCommands(userName, channelId, messageContent);
        if( commandResponse) // if a command returns something, reply as a message and returns
        {
            discordMessage.reply(commandResponse);
            return;
        }

        const userConversation = getUserConversation(userName, channelId);

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

function getUserConversation(userName, channelId)
{
    let conversationKey = userName + "_" + channelId;
    return conversations[conversationKey];
}

function setUserConversation(userName, channelId, conversation)
{
    let conversationKey = userName + "_" + channelId;
    conversations[conversationKey] = conversation;
}

function initConversationAndProcessCommands(userName, channelId, messageContent)
{
    let msg = messageContent.trim().toLowerCase();
        
    let userConversation;

    let capturePattern=/(?<hello>hi|hello|olá|ola|oi)\s*(?<model>turbo|ada|davinci|curie|babbage|codex)*\s*(?<temp>\d+(\.\d{1})*)*/;
    let patternFound = msg.match(capturePattern);
    if( patternFound )
    {
        let language = detectLanguageFromHello(patternFound.groups.hello);
        userConversation = new Conversation(userName, 
                                            language, 
                                            parseInt(process.env.TOKENS_TO_RESERVE_FOR_COMPLETION));

        setUserConversation( userName, channelId, userConversation );

        let model = patternFound.groups.model;
        if( model && model.length>0)
            changeConversationModel(userConversation, model);    

        let temp = patternFound.groups.temp;
        if( temp && temp.length>0)
            changeConversationTemperature(userConversation, temp);

        let returnMessage = "";
        if( language == "PT")
            returnMessage = `Olá.\nSou o Rob. Sou um robô especialista nos mais variados assuntos.\nComo posso te ajudar?`;
        else
            returnMessage = `Hi.\nI'm Rob. I'm a friendly robot.\nHow can I help you?`;
        
        return `(model=${userConversation.getResponseModel()}, temperature=${userConversation.getTemperature()})\r\n${returnMessage}`;
    }

    userConversation = getUserConversation(userName, channelId);
    if( !userConversation)
    {
        userConversation = new Conversation(userName, 
                                            defaultLanguage, 
                                            parseInt(process.env.TOKENS_TO_RESERVE_FOR_COMPLETION));

        setUserConversation(userName, channelId, userConversation);
    }

    if( msg.startsWith("\\"))  // it is a command message
        msg = msg.substring(1); // removes the command character
    else
        if( msg.startsWith("?")) // it start with a ? ignores all and show the help instructions
            msg = msg.substring(0, 2); // to accept ? and ?? helps
        else
            return null

    capturePattern=/change\s+model\s+to\s+(?<model>turbo|ada|davinci|curie|babbage|codex)/;
    patternFound = msg.match(capturePattern);
    if( patternFound )
    {
        changeConversationModel(userConversation, patternFound.groups.model.trim());    
        return `Model changed to **${userConversation.getResponseModel()}**`;
    }

    capturePattern=/change\s+temp\s+to\s+(?<temp>\d+(.\d{1})*)/;
    patternFound = msg.match(capturePattern);
    if( patternFound )
    {
        try
        {
            const newTemp = parseFloat(patternFound.groups.temp);
            if( newTemp>=0 && newTemp<=2)
            {
                const oldTemp = userConversation.getTemperature();
                userConversation.setTemperature(newTemp);
                return `Temperature changed from ${oldTemp} to **${userConversation.getTemperature()}**`;
            }
            else
                return 'Temperature must be between 0.0 and 2.0';
        }
        catch(err)
        {
            return 'Temperature must be between 0.0 and 2.0';
        }
    }

    if( msg === "??" || msg === "show conversation params")
    {
        return `**Conversation params:**

Model = **${userConversation.responseModel}**
Temperature = **${userConversation.temperature}**
Prefered Language = **${userConversation.preferredLanguage}**
        `;
    }

    if( msg === "?" )
    {
        return `**Possible commands:**

**?** shows this.

**Hi** or **Oi** : clear all chat history and resets model to the default gpt-3.5-turbo model
    **Hi** or **Hello** resets to English as the preferred language
    **Oi** or **olá** resets to Portuguese as the preferred language

**Hi** or **Oi** **<model> <temperature>** : clear all chat history and resets conversation with the model and temperature choosen
    <model> and <temperature> parameters are optional. The default values are "turbo" and 0.7 respectively.
    Example1: **Hi turbo 0.3**   *(uses gpt-3.5-turbo with temperature=0.3)*
    Example2: **Oi davinci**  *(uses text-davinci-003 with temperature=0.7)*

**\\change model to <model>** : changes the chatGPT model used for the conversation.
    <model> can be one of: turbo, ada, davinci, curie, babbage, codex
    Example: **\\change model to davinci**

**\\change temp to <temp>** : changes the temperature of the model
    <temp> must be between 0.0 and 2.0
    Example: **\\change temp to 0.5**

**\\??** or **\\show conversation params**: shows the current conversation params
`
    }

    if( userConversation.getUserPreferredLanguage() == "PT")
        return "Comando não reconhecido";

    return "Command not recognized";
}


function changeConversationModel(userConversation, model)
{
    if( model == 'davinci')
    userConversation.setResponseModel('text-davinci-003');
    else
    if( model == 'ada')
        userConversation.setResponseModel('text-ada-001');
    else
    if( model == 'curie')
        userConversation.setResponseModel('text-curie-001');
    else
    if( model == 'babbage')
        userConversation.setResponseModel('text-babbage-001');
    else
    if( model == 'codex')
        userConversation.setResponseModel('code-davinci-002');
    else
    if( model == 'turbo')
        userConversation.setResponseModel('gpt-3.5-turbo');
    else
    if( model == 'gpt4')
        userConversation.setResponseModel('gpt-3.5-turbo');
    else
        userConversation.setResponseModel('gpt-3.5-turbo');

    return userConversation.getResponseModel();
}

function changeConversationTemperature(userConversation, newTemperature)
{
    try
    {
        const newTemp = parseFloat(newTemperature);
        if( newTemp>=0 && newTemp<=2)
        {
            const oldTemp = userConversation.getTemperature();
            userConversation.setTemperature(newTemp);
            return `Temperature changed from ${oldTemp} to **${userConversation.getTemperature()}**`;
        }
        else
            return 'Temperature must be between 0.0 and 2.0';
    }
    catch(err)
    {
        return 'Temperature must be between 0.0 and 2.0';
    }
}

function detectLanguageFromHello(msg)
{
    let hellos = {
        EN : ["hi", "hello"],
        PT : ["olá", "ola", "oi"]
    }

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

