# chatGPTDiscordBot
This is a simple chatGPT bot for Discord capable of keeping the conversation history.
By default, this Bot uses the 'gpt-3.5-turbo' openAI model.
Below is a chat example:
(Unfortunately this model is not yet good at complex calculations but I tested this with chatGPT-4 and the results were just perfect. I will update this for chatGPT-4 as soon as their API is available.)

![alt text](./images/chat_sample.png)

To run this Bot, follow these steps:

1) Clone the repository and open it in Visual Studio Code.

2) Copy the .env_sample file and rename it to .env.

3) Create a bot in Discord and obtain its access token. Paste this token in the DISCORD_TOKEN key in the .env file.

4) Create an OpenAI account and generate an API key. Copy the OpenAI API key and OpenAI  Organization keys to the OPENAI_KEY and OPENAI_ORGANIZATION keys in the .env file.

5) Open a terminal in VS Code and run npm install.

6) Run npm start dev to start the application.

7) Open Discord and talk to the robot. IMPORTANT: You must start your questions with "Rob," or "Rob:" so the robot knows you are addressing it and not someone else. Example: Rob, how many planets are in our solar system?

Observations:

This robot(Rob) can store a certain number of previous messages in order to be able to mantain the conversations. If you wish to clear all previous messages and start a new topic all you have to do is say: "Rob, Hi"
The conversations is stored in memory and it will be lost if the service is rebooted



