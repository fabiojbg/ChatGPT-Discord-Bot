const Prompt = require("./Prompt")

function Conversation(userName, language, maxConversationLength)
{
    this.prompt = new Prompt(language);
    this.userName = userName;
    this.conversation = [];
    this.preferredLanguage = language;
    this.temperature = 0.7;
    this.responseModel = 'gpt-3.5-turbo';
    this.maxConversationLength = maxConversationLength | 3000;
    this.usage={}; 
    this.usage["PromptTokens"]=0;
    this.usage["CompletionTokens"]=0;
    this.usage["TotalTokens"]=0;
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
    this.conversation = clearOldUserMessagesIfNeeded(this.conversation, this.maxConversationLength);
}

Conversation.prototype.getFullConversation = function (format = "chat")
{
    const conversation = [...this.prompt.getChatPrompt(), 
                          ...this.conversation];

    if( format === "text")                          
        return getConversationText(conversation);

    return conversation;
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

function clearOldUserMessagesIfNeeded(conversation, maxConversationLength)
{
    if( conversation.length < 2)
        return conversation;
    let i;
    let charMsgCount = 0;
    for( i = conversation.length-1; i>=0; i--)
    {
        charMsgCount += conversation[i].content.length;
        if( charMsgCount > maxConversationLength)
        {            
            breakPoint = i-conversation.length+1;
            conversation = conversation.slice(breakPoint) // get last messages
            break;
        }
    }
    return conversation;
}

function numTokenFromMessages()  // TODO
{
    try
    {

    }
    catch(err)
    {
        console.log(`Model `)
    }
}


module.exports = Conversation;