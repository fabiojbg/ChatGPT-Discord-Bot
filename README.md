# ChatGPT Discord Bot
This is a very complete ChatGPT Bot for Discord capable of keeping the conversation history and change models and its parameters. In fact, this **Bot** keeps the most possible conversation history supported for the model. For example: if the 'gpt-3.5-turbo' model is being used, the bot will keep the most conversation history that consumes up to the 4096 tokens supported by the model. In fact, the bot saves some tokens for the bot responses, this can be set in the parameter TOKENS_TO_RESERVE_FOR_COMPLETION in the .env file.

By default, this Bot uses the 'gpt-3.5-turbo' openAI model. 

You can change the default Bot parameters with backlash ('\\') commands supported by the Bot. Type '?' and the Bot will list all the supported commands for you.

To direct you messages to the Bot, you must start your messages with "rob, ". You don't need to to this if your in a private chat with the bot or there is only you and the bot in the channel.

Below there is a chat example.

![alt text](./images/chat_sample.png)

To run this Bot, follow these steps:

1) Clone the repository and open it in Visual Studio Code.

2) Copy the .env_sample file and rename it to .env.

3) Create a bot in Discord and obtain its access token. This video from Adrian Twarog can help you on this: https://www.youtube.com/watch?v=roMykVsig-A&t=83s

4) Paste the bot token generated in the previous step in the DISCORD_TOKEN key in the .env file.

5) Create an OpenAI account and generate an API key. Copy the OpenAI API key and OpenAI Organization keys to the OPENAI_KEY and OPENAI_ORGANIZATION keys in the .env file. You may need to buy some credits to use the ChatGPT api.

6) Open a terminal in VS Code and run npm install.

7) Run npm start dev to start the bot.


Warnings about this version: 
- The conversations are separated for each user and are stored only in memory in this version. All conversations will be lost if the service is rebooted. 



