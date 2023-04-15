const { Configuration, OpenAIApi} = require('openai')


function ChatGPT(organization, apiKey)
{
    const openAiConfiguration = new Configuration({
        organization: organization,
        apiKey: apiKey
    });
    
    this.openAI = new OpenAIApi(openAiConfiguration);    
}

ChatGPT.prototype.createCompletion = async function (conversation)
{
    if( conversation.getCurrentModelType() === 'chat')
    {
        return await createChatCompletion(this.openAI, conversation);
    }

    return await createCompletion(this.openAI, conversation);    
}

async function createChatCompletion(openAI, conversation)
{
    if(!conversation)
        return { success: false, 
                responseMsg:`conversation is empty`};
    try
    {
        let maxConversationTokens = conversation.getMaxTokensSupported();
        let usedTokens = conversation.getCurrentConversationTokens();
        let maxTokens = maxConversationTokens - usedTokens;

        let gptResponse = await openAI.createChatCompletion({
            model: conversation.responseModel,
            messages: conversation.getFullConversation(),
            temperature: conversation.temperature,
            max_tokens: maxTokens - 20,
        })

        if( gptResponse.status == 200)
        {
            let responseMsg = gptResponse.data.choices[0].message.content;        
            conversation.appendMessage('assistant', responseMsg);

            const usage = gptResponse.data.usage;

            conversation.updateUserUsage(usage, true); // update the token used by the user

            console.log( responseMsg );

            return { success: true, 
                     responseMsg:responseMsg};
        }
        return { success: false, 
                 responseMsg:`OpenApi error: ${gptResponse.statusText}.Error Content: ${gptResponse.data}`};
    }
    catch(err)
    {
        console.log("There was an error communicating with OpenAI Api. Error = " + err + "\r\n" + err.stack);

        return { success: false, 
                 responseMsg: "There was an error communicating with openAI Api Error = " + err + "\nChatGPT Error=" + (err?.response?.data?.error?.message ?? "Unspecified") };
    }

}

async function createCompletion(openai, conversation)
{
    try
    {
        // conversation must have the prompt in the begining
        var promptWithConversation = conversation.getFullConversation();
        var maxConversationTokens = conversation.getMaxTokensSupported();
        var usedTokens = conversation.getCurrentConversationTokens();
        let maxTokens = maxConversationTokens - usedTokens;

        console.log(`**********************\n${promptWithConversation}`);
        gptResponse = await openai.createCompletion({
            model: conversation.responseModel,
            prompt: promptWithConversation + "\r\nRob: ",
            temperature: conversation.temperature,
            max_tokens: maxTokens - 20,
        })

        if( gptResponse.status == 200)
        {
            let responseMsg = gptResponse.data.choices[0].text;        
      
            conversation.appendMessage('assistant', responseMsg);

            const usage = gptResponse.data.usage;

            conversation.updateUserUsage(usage, true); // update the token used by the user

            console.log( responseMsg );

            return { success: true, 
                     responseMsg:responseMsg};
        }

        return { success: false, 
            responseMsg:`OpenApi error: ${gptResponse.statusText}.Error Content: ${gptResponse.data}`};
    }
    catch(err)
    {
        console.log("There was an error communicating with OpenAI Api. Error = " + err);

        return { success: false, 
                 responseMsg: "There was an error communicating with openAI Api Error = " + err + "\nChatGPT Error=" + (err?.response?.data?.error?.message ?? "Unspecified") };
    }
}

module.exports = ChatGPT;

