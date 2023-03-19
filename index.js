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

prompts.PT = `Você é um robô especialista nos mais variados assuntos e seu nome é Rob. Os usuários farão perguntas e você responderá de forma bem detalhada mesmo que precisa fornecer uma responsa longa.
Rob: Olá. Sou um robô especialista em vários assuntos.
Usuário: Olá.
Rob: O que você gostaria de saber?`;

prompts.PT_Turbo = [{role: "system", content: `Você é um robô especialista nos mais variados assuntos e seu nome é Rob. Os usuários farão perguntas e você responderá de forma bem detalhada mesmo que precisa fornecer uma responsa longa.`},
{role: "assistant", content:"Olá. Sou um robô especialista em vários assuntos."},
{role: "user", content:"Olá."},
{role: "assistant", content:"O que você gostaria de saber?"}];

prompts.EN = `You're a friendly robot and your name is Rob. The users will make questions for you and you will responde it politely and with details.
Rob: Hi. I'm a friendly robot.
User: Hi.
Rob: What would you like to know?`;

prompts.EN_Turbo = [{role: "system", content: `You're a friendly robot and your name is Rob. The users will make questions for you and you will responde it politely and with details.`},
{role: "assistant", content:"Hi. I'm a friendly robot."},
{role: "user", content:"Hi."},
{role: "assistant", content:"What would you like to know?"}];


var userData = {};

discordClient.on('messageCreate', async function(message){
    var userName = message.author.username;
    
    try{
        if( message.author.bot) 
            return;        

        var messageContent = message.content.trim();

        if( !messageContent.toLowerCase().startsWith("rob:") &&
            !messageContent.toLowerCase().startsWith("rob,"))
        {
            return;            
        }

        messageContent = messageContent.substring(4).trim();

        // process cany user commands if needed
        var commandResponse = processCommands(userName, messageContent);
        if( commandResponse) // if a command returns something, reply as a message and returns
        {
            message.reply(commandResponse);
            return;
        }

        // appends user conversation to history
        userData[userName].conversation += `\n\n${userName}: ${messageContent}\n\Rob: `;        
        userData[userName].conversationTurbo.push({"role" : "user", "content": messageContent});

        clearOldUserMessagesIfNeeded(userName, process.env.MAX_USER_CONVERSATION_CHARS);

        let gptResponse;
        if( userData[userName].responseModel == 'gpt-3.5-turbo')
        {            
            let conv = [...userData[userName].promptTurbo, ...userData[userName].conversationTurbo];
            gptResponse = await openai.createChatCompletion({
                model: 'gpt-3.5-turbo',
                messages: conv,
                temperature: userData[userName].temperature,
            })
        }
        else
        {
        // conversation must have the prompt in the begining
        var promptWithConversation = `${userData[userName].prompt}${userData[userName].conversation}`;
            console.log(`**********************\n${promptWithConversation}`);
            gptResponse = await openai.createCompletion({
                model: userData[userName].responseModel,
                prompt: promptWithConversation,
                temperature: userData[userName].temperature,
                max_tokens: 2000,
            })
        }

        if( gptResponse.status == 200)
        {
            let responseMsg;
            if( userData[userName].responseModel == 'gpt-3.5-turbo')
            {
                responseMsg = gptResponse.data.choices[0].message.content;        
                userData[userName].conversationTurbo.push(gptResponse.data.choices[0].message);
                userData[userName].conversation += `${responseMsg}`;
            }
            else
            {
                responseMsg = gptResponse.data.choices[0].text;        
                userData[userName].conversation += `${responseMsg}`;
                userData[userName].conversationTurbo.push({role:"assistant", content: responseMsg});
            }

            const usage = gptResponse.data.usage;

            console.log( responseMsg );

            updateUserUsage(userName, usage, true); // update the token used by the user

            message.reply(`${responseMsg}\n(Total Tokens=${usage.total_tokens})`);
        }
        else
        {
            message.reply(`OpenApi error: ${gptResponse.statusText}.Error Content: ${gptResponse.data}`);
        }
    }
    catch(err)
    {
        console.log("Houve um erro na comunicação com a OpenAI. Erro = " + err);
        message.reply("Houve um erro na comunicação com a OpenAI. Erro = " + err + "\nChatGPT Error=" + err.response.data.error.message);
    }

})

function processCommands(userName, messageContent)
{
    if( isHello(messageContent))
    {
        var language = getLanguageFromHello(messageContent);
        var helloMessage = initNewUser(userName, language);
        return helloMessage;
    }
    if( !userData[userName])
    {
        initNewUser(userName);
    }
    var msg = messageContent;
    var capturePattern=/change model to (?<model>turbo|ada|davinci|curie|babbage|codex)/;
    var foundPattern = msg.toLowerCase().match(capturePattern);
    if( foundPattern )
    {
        if( foundPattern.groups.model == 'davinci')
        userData[userName].responseModel = 'text-davinci-003';
        else
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
        userData[userName].responseModel = 'gpt-3.5-turbo';
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
    userData[userName].promptTurbo = prompts[language+'_Turbo'];
    userData[userName].conversationTurbo = [];
    userData[userName].preferredLanguage = language;
    userData[userName].responseModel = 'gpt-3.5-turbo';

    userData[userName].usage={}; 
    userData[userName].usage["PromptTokens"]=0;
    userData[userName].usage["CompletionTokens"]=0;
    userData[userName].usage["TotalTokens"]=0;

    if( language=="PT")
        return `Olá.\nSou o Rob. Sou um robô especialista nos mais variados assuntos.\nComo posso te ajudar?`;
    
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

    if( userData[userName].conversationTurbo.length < 2)
        return;
    let i;
    let charMsgCount = 0;
    for( i = userData[userName].conversationTurbo.length-1; i>=0; i--)
    {
        charMsgCount += userData[userName].conversationTurbo.content.length;
        if( charMsgCount > maxChars)
        {            
            breakPoint = i-userData[userName].conversationTurbo+1;
            userData[userName].conversationTurbo = userData[userName].conversationTurbo.slice(breakPoint) // get last messages
            break;
        }
    }
}

discordClient.login(process.env.DISCORD_TOKEN);
console.log("ChatGPT Botelho Bot is online on Discord");

