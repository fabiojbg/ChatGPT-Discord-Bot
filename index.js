require('dotenv').config()

//Prepare to connect to the Discord APi
const { Client, GatewayIntentBits } = require('discord.js')

const discordClient = new Client({intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
]})

const { Configuration, OpenAIApi} = require('openai')
const openAiConfiguration = new Configuration({
    organization: process.env.OPENAI_ORGANIZATION,
    apiKey: process.env.OPENAI_KEY
});

const openai = new OpenAIApi(openAiConfiguration);

var prompts = {};

prompts.PT = `Você é um robô amigável e seu nome é Rob. Os usuários farão perguntas e você responderá de forma amigável
Rob: Olá. Sou um robô amigável.
Usuário: Olá.
Rob: O que você gostaria de saber?`;

prompts.EN = `You're a friendly robot and your name is Rob. The users will make questions for you and you will responde it politely.
Rob: Hi. I'm a friendly robot
Usuário: Hi.
Rob: What would you like to know?`;

// prompts.EN = ``;
// prompts.PT = ``;

var userData = {};

discordClient.on('messageCreate', async function(message){
    var userName = message.author.username;
    
    try{
        if( message.author.bot) return;        

        // process cany user commands if needed
        var commandResponse = processCommands(userName, message);
        if( commandResponse) // if a command returns something, reply as a message and returns
        {
            message.reply(commandResponse);
            return;
        }

        // appends user conversation to history
        userData[userName].conversation += `\n\n${userName}: ${message.content}\n\Rob: `;

        clearOldUserMessagesIfNeeded(userName, process.env.MAX_USER_CONVERSATION_CHARS);

        // conversation must have the prompt in the begining
        var promptWithConversation = `${userData[userName].prompt}${userData[userName].conversation}`;
        console.log(`**********************\n${promptWithConversation}`);

        const gptResponse = await openai.createCompletion({
            model: userData[userName].responseModel,
            prompt: promptWithConversation,
            temperature: userData[userName].temperature,
            max_tokens: 2000,
            stop: ["Rob: ", `${userName}:`]
        })

        if( gptResponse.status == 200)
        {
            const responseMsg = gptResponse.data.choices[0].text;        
            const usage = gptResponse.data.usage;

            console.log( responseMsg );

            updateUserUsage(userName, usage, true); // update the token used by the user

            message.reply(`${responseMsg}\n(Total Tokens=${usage.total_tokens})`);

            userData[userName].conversation += `${responseMsg}`;
        }
        else
        {
            message.reply(`OpenApi error: ${gptResponse.statusText}`);
        }
    }
    catch(err)
    {
        console.log("Houve um erro na comunicação com a OpenAI. Erro = " + err);
        message.reply("Houve um erro na comunicação com a OpenAI. Erro = " + err);
    }

})

function processCommands(userName, message)
{
    if( isHello(message.content))
    {
        var language = getLanguageFromHello(message.content);
        var helloMessage = initNewUser(userName, language);
        return helloMessage;
    }
    if( !userData[userName])
    {
        initNewUser(userName);
    }
    var msg = message.content;
    var capturePattern=/change model to (?<model>ada|davinci|curie|babbage|codex)/;
    var foundPattern = msg.toLowerCase().match(capturePattern);
    if( foundPattern )
    {
        if( foundPattern.groups.model == 'ada')
            userData[userName].responseModel = 'text-ada-001';
        else
        if( foundPattern.groups.model == 'curie')
            userData[userName].responseModel = 'text-curie-001';
        else
        if( foundPattern.groups.model == 'babbage')
            userData[userName].responseModel = 'text-babbage-001';
        else
        if( foundPattern.groups.model == 'codex')
            userData[userName].responseModel = 'code-davinci-002';
        else
            userData[userName].responseModel = 'text-davinci-003';
        return `Model changed to ${userData[userName].responseModel}`;
    }

    capturePattern=/change temp to (?<temp>\d+(.\d{1}))/;
    foundPattern = msg.toLowerCase().match(capturePattern);
    if( foundPattern )
    {
        var newTemp = parseFloat(foundPattern.groups.temp);
        if( newTemp>=0 && newTemp<=1)
        {
            const oldTemp = userData[userName].temperature;
            userData[userName].temperature = newTemp;
            return `Temperature changed from ${oldTemp} to ${userData[userName].temperature}`;
        }
        else
            return 'Invalid command';
    }

    return null;
}

function initNewUser(userName, language)
{
    if( !language || (language != "PT" && language != "EN"))
        language = "PT";

    userData[userName] ={};
    userData[userName].temperature = 0.7;
    userData[userName].prompt = prompts[language];
    userData[userName].conversation = '';
    userData[userName].preferredLanguage = language;
    userData[userName].responseModel = 'text-davinci-003';

    userData[userName].usage={}; 
    userData[userName].usage["PromptTokens"]=0;
    userData[userName].usage["CompletionTokens"]=0;
    userData[userName].usage["TotalTokens"]=0;

    if( language=="PT")
        return `Olá.\nSou o Rob. Sou um robô amigável.\nComo posso te ajudar?`;
    
    return `Hi.\nI'm Rob. I'm a friendly robot.\nHow can I help you?`;
}

function isHello(msg)
{
    if( msg.toLowerCase()=='olá' || msg.toLowerCase()=='ola' || msg.toLowerCase()=='oi')
        return true;

    if( msg.toLowerCase()=='hi' || msg.toLowerCase()=='hello')
        return true;

    return false;
}

function getLanguageFromHello(msg)
{
    if( msg.toLowerCase()=='hi' || msg.toLowerCase()=='hello')
        return "EN";

    if( msg.toLowerCase()=='olá' || msg.toLowerCase()=='ola' || msg.toLowerCase()=='oi')
        return "PT";

    return null;
}

function updateUserUsage(userName, usage, showInConsole)
{
    var userUsage = userData[userName].usage;
    userUsage["PromptTokens"] = userUsage["PromptTokens"] + usage.prompt_tokens;
    userUsage["CompletionTokens"] = userUsage["CompletionTokens"] + usage.completion_tokens;
    userUsage["TotalTokens"] = userUsage["TotalTokens"] + usage.total_tokens;

    if( showInConsole)
    {
        var userUsage = userData[userName].usage;
        console.log(`
Prompt Tokens: ${usage.prompt_tokens}/${userUsage["PromptTokens"]}
Complt Tokens: ${usage.completion_tokens}/${userUsage["CompletionTokens"]}
Total  Tokens: ${usage.total_tokens}/${userUsage["TotalTokens"]}
`);
    }

}

function clearOldUserMessagesIfNeeded(userName, maxChars)
{
    if( userData[userName].conversation.length , maxChars )
        return;
    var searchStr = `${userName}:`;
    var str = userData[userName].conversation;
    do
    {
        var firstOccurence = str.indexOf(searchStr);
        if( firstOccurence == -1)
            break;
        var secondIndex = str.indexOf(searchStr, firstOccurence + searchStr.length);
        if (secondIndex != -1) {
            str = str.substring(secondIndex);
    }
    } while (str.length>maxChars);   

    userData[userName].conversation = str;
    console.log(`Conversation of user ${userName} was trimmed`);
}


discordClient.login(process.env.DISCORD_TOKEN);
console.log("ChatGPT Botelho Bot is online on Discord");

