const fs = require('fs');
const pdfParse = require('pdf-parse');
const request = require('request');
const tiktoken = require('tiktoken-node')
require('dotenv').config()

const { Configuration, OpenAIApi} = require('openai')

function ChatGPTSummarizer(organization, apiKey)
{
    const openAiConfiguration = new Configuration({
        organization: organization,
        apiKey: apiKey
    });
    
    this.openAI = new OpenAIApi(openAiConfiguration);    
}

ChatGPTSummarizer.prototype.summarizeMessageAttachments = function(preferredLanguage, message)
{
    let attachments = message.attachments;
    let openAI = this.openAI;
    attachments.each((attachment) => 
    {

        console.log(`Attachment URL: ${attachment.url}`);
        console.log(`Attachment filename: ${attachment.name}`);
        console.log(`Attachment size: ${attachment.size} bytes`);
        request(attachment.url)
               .pipe(fs.createWriteStream(`./download/${attachment.name}`))
               .on('finish', ()=>{ pdfToText(`./download/${attachment.name}`)
                                   .then( async(pdfText) => { 
                                          var summary = await chatGPTSummarizer(openAI, preferredLanguage, pdfText, message); 
                                          message.reply(summary);
                                    } )
                                   .catch(function(err){ 
                                      console.log(err);
                                    })}
              );        
              });
}

const chatGPTSummarizer = async (openAI, preferredLanguage, text, discordMessage) =>
{
    try
    {
        let prompt;
        let maxChars = 30000;
        let model = "gpt-3.5-turbo";
        let tokensToRespose = parseInt(process.env.TOKENS_TO_RESERVE_FOR_COMPLETION);

        if( text.length < 30000)
          maxChars = text.length;

        do
        {
          if( preferredLanguage === "EN")
          {
              prompt = [{role: "system", content: `You are a robot specialized in text summarization`},
                        {role: "user", content:"Summarize this with the most complete answer possible: " + text.substring(0, maxChars)}];
          }
          else
          {
              prompt = [{role: "system", content: `Você é um robô que faz o resumo de textos`},
                        {role: "user", content:"Faça um resumo disto com a resposta mais completa possível:" + text.substring(0, maxChars)}];
          }
          let messageTokens = num_tokens_from_messages(prompt, model);          

          if( (messageTokens + tokensToRespose) > 4096 )
            maxChars -= 500;
          else
            break;

        } while (true);

        await discordMessage.channel.sendTyping(); // show users the bot is typing

        gptResponse = await openAI.createChatCompletion({
            model: model,
            messages: prompt,
            temperature: 0.7,
            });
        
        if( gptResponse.status == 200)
        {
            let responseMsg;
            responseMsg = gptResponse.data.choices[0].message.content;        

            let usage = gptResponse.data.usage;
            console.log( responseMsg );

            return `${responseMsg}\n(Total Tokens=${usage.total_tokens} / Characters processed from document=${maxChars})`;
        }
        else
        {
            return `OpenApi error: ${gptResponse.statusText}.Error Content: ${gptResponse.data}`;
        }
    }
    catch(err)
    {
        console.log("There was an error communicating with OpenAI Api. Error = " + err);

        return "There was an error communicating with openAI Api Error = " + err + "\nChatGPT Error=" + (err?.response?.data?.error?.message ?? "Unspecified");
    }
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

function pdfToText(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, pdfBuffer) => {
      if (err) {
        reject(err);
      } else {
        pdfParse(pdfBuffer)
          .then((data) => {
            resolve(data.text);
          })
          .catch((error) => {
            reject(error);
          });
      }
    });
  });
}

module.exports = ChatGPTSummarizer;