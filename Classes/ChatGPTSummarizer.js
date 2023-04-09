const fs = require('fs');
const pdfParse = require('pdf-parse');
const request = require('request');
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
                                          var summary = await chatGPTSummarizer(openAI, preferredLanguage, pdfText); 
                                          message.reply(summary);
                                    } )
                                   .catch(function(err){ 
                                      console.log(err);
                                    })}
              );        
              });
}

const chatGPTSummarizer = async (openAI, preferredLanguage, text) =>
{
    try
    {
        let prompt;

        if( preferredLanguage === "EN")
        {
            prompt = [{role: "system", content: `You are a robot specialized in text summarization`},
                      {role: "user", content:"Summarize this: " + text.substring(0, 10000)}];
        }
        else
        {
            prompt = [{role: "system", content: `Você é um robô que faz o resumo de textos`},
                      {role: "user", content:"Faça um resumo disto:" + text.substring(0, 10000)}];
        }

        gptResponse = await openAI.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: prompt,
            temperature: 0.7,
            });
        
        if( gptResponse.status == 200)
        {
            let responseMsg;
            responseMsg = gptResponse.data.choices[0].message.content;        

            let usage = gptResponse.data.usage;
            console.log( responseMsg );

            return `${responseMsg}\n(Total Tokens=${usage.total_tokens})`;
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