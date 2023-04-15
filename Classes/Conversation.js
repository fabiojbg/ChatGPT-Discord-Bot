const Prompt = require("./Prompt")
const tiktoken = require('tiktoken-node')

function Conversation(userName, language, minTokensToReseveForConversation)
{
    this.prompt = new Prompt(language);
    this.userName = userName;
    this.conversation = [];
    this.preferredLanguage = language;
    this.temperature = 0.7;
    this.responseModel = 'gpt-3.5-turbo';
    this.usage={}; 
    this.usage["PromptTokens"]=0;
    this.usage["CompletionTokens"]=0;
    this.usage["TotalTokens"]=0;
    this.minTokensToReseveForConversation = minTokensToReseveForConversation | 500;
    this.tokensPerModel = [
        { model: "gpt-3.5-turbo", capacity: 4096},
        { model: "gpt-3.5-turbo-0301", capacity: 4096},
        { model: "text-davinci-003", capacity: 4097},
        { model: "text-davinci-002", capacity: 4097},
        { model: "code-davinci-002", capacity: 8001},
        { model: "text-curie-001", capacity: 2049},
        { model: "text-babbage-001", capacity: 2049},
        { model: "text-ada-001", capacity: 2049}
    ];
}

const _completionModels = [ 'text-davinci-003',
'text-ada-001',
'text-curie-001',
'text-babbage-001',
'code-davinci-002'];

const _chatModels =['gpt-3.5-turbo', 
'gpt-3.5-turbo-0301', 
'gpt-4', 
'gpt-4-0314'];

Conversation.prototype.getCurrentModelType = function ()
{
    if( _completionModels.indexOf(this.responseModel)!=-1)
        return 'completion';

    return 'chat';
}

Conversation.prototype.setResponseModel = function (modelName)
{
    let model = modelName.trim().toLowerCase();
    if( _completionModels.indexOf(model)>0 || 
        _chatModels.indexOf(model) )
    {
        this.responseModel = model;
    }
}

Conversation.prototype.getResponseModel = function ()
{
    return this.responseModel;
}

Conversation.prototype.setTemperature = function (temperature)
{
    this.temperature = temperature;
}

Conversation.prototype.getTemperature = function ()
{
    return this.temperature;
}

Conversation.prototype.getUserPreferredLanguage = function ()
{
    return this.preferredLanguage;
}

Conversation.prototype.getMetric = function(metricName)
{
    return this.usage[metricName];
}

Conversation.prototype.appendMessage = function (role, message)
{
    this.conversation.push({ role: role, content: message.trim()})

    // always remove old messages to always leave tokens available to continue conversation (given by this.minTokensToReseveForConversation)
    let modelCapacity = getMaxTokensForModel(this.tokensPerModel, this.responseModel);
    this.conversation = clearOldMessagesIfNeeded(this.prompt.getChatPrompt(), this.conversation, this.responseModel, modelCapacity - this.minTokensToReseveForConversation);
}

Conversation.prototype.getCurrentConversationTokens = function()
{
    if( this.getCurrentModelType() == "chat" )
        return num_tokens_from_messages(this.getFullConversation(), this.responseModel);

    return num_tokens_from_conversation_text( this.getFullConversation(), this.responseModel);    
}

Conversation.prototype.getFullConversation = function (format = "chat")
{
    let conversationType = this.getCurrentModelType();

    const conversation = [...this.prompt.getChatPrompt(), 
                          ...this.conversation];

    if( conversationType === "text")                          
        return getConversationText(conversation);

    return conversation;
}

Conversation.prototype.getMaxTokensSupported = function ()
{
    return getMaxTokensForModel(this.tokensPerModel, this.responseModel);
}

Conversation.prototype.updateUserUsage = function (usage, showInConsole)
{
    let userUsage = this.usage;
    userUsage["PromptTokens"] = userUsage["PromptTokens"] + usage.prompt_tokens;
    userUsage["CompletionTokens"] = userUsage["CompletionTokens"] + usage.completion_tokens;
    userUsage["TotalTokens"] = userUsage["TotalTokens"] + usage.total_tokens;

    if( showInConsole)
    {
        console.log(`
Prompt Tokens: ${usage.prompt_tokens}/${userUsage["PromptTokens"]}
Complt Tokens: ${usage.completion_tokens}/${userUsage["CompletionTokens"]}
Total  Tokens: ${usage.total_tokens}/${userUsage["TotalTokens"]}
`);
    }

}


function getConversationText(sentences)
{
    const textConversation = sentences.reduce( (accumulator, currentValue) => 
    {
        if( currentValue.role == "system")
            return currentValue.content;
        else
        if( currentValue.role == "assistant")
            return accumulator + '\r\nRob: ' + currentValue.content;
        else 
        if( currentValue.role == "user")
            return accumulator + '\r\nUser: ' + currentValue.content;
    }, '');

    return textConversation;        
}

function clearOldMessagesIfNeeded(prompt, messages, model, maxTokensToKeepInMessages)
{
    let i = 0;
    let truncatedMessages;
    let conversationTokens;
    do
    {
        truncatedMessages = [...prompt, 
                             ...messages.slice(i)];
        conversationTokens = num_tokens_from_messages(truncatedMessages, model);

    } while (conversationTokens > maxTokensToKeepInMessages);

    if( i == 0)
        return messages;
    
    return messages.slice(i);
}


function getMaxTokensForModel(modelLimits, model)
{
    let res = modelLimits.filter( modelLimit => modelLimit.model == model );
    if( res.length == 0)
        return 2046;

    return res[0].capacity;
}

function num_tokens_from_messages(messages, model) 
{
    // adapted from https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
    let tokens_per_message = 0;
    let tokens_per_name = 0;
    try
    {
        let encoding = tiktoken.encodingForModel(model);
        if( model === "gpt-3.5-turbo")
        {
            console.log("Warning: gpt-3.5-turbo may change over time. Returning num tokens assuming gpt-3.5-turbo-0301.");
            return num_tokens_from_messages(messages, "gpt-3.5-turbo-0301");
        }
        else if( model === "gpt-4" )
        {
            console.log("Warning: gpt-4 may change over time. Returning num tokens assuming gpt-4-0314.")
            return num_tokens_from_messages(messages, "gpt-4-0314")
        }
        else if( model === "gpt-3.5-turbo-0301")
        {
            tokens_per_message = 4 // every message follows <|start|>{role/name}\n{content}<|end|>\n
            tokens_per_name = -1  // if there's a name, the role is omitted
        }
        else if( model === "gpt-4-0314")
        {
            tokens_per_message = 3
            tokens_per_name = 1        
        }
        else
            encoding = tiktoken.getEncoding("cl100k_base");

        let i = 0;
        let num_tokens = 0;
        while( i < messages.length)
        {
            let message = messages[i];
            num_tokens += tokens_per_message;
            for (var prop in message) {
                if (Object.prototype.hasOwnProperty.call(message, prop)) {
                    let tokens = encoding.encode(message[prop]);
                    num_tokens += tokens.length;
                    if( prop === "name")
                        num_tokens += tokens_per_name;
                }
            }
            i++;
        }
        num_tokens += 3;
        return num_tokens;
    }
    catch(err)
    {
        console.log("There was an error calculating tokens. Error = " + err + "\r\n" + err.stack);
    }
}

function num_tokens_from_conversation_text(conversationText, model) 
{
    try
    {
        let encoding = tiktoken.encodingForModel(model);
        let tokens = encoding.encode(conversationText);
        return tokens.length;
    }
    catch(err)
    {
        console.log("There was an error calculating tokens. Error = " + err + "\r\n" + err.stack);
    }
    
}

module.exports = Conversation;