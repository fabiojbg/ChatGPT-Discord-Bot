function Prompt(language)
{
    if( language === "PT")
    {
        this.prompt = [{role: "system", content: `Você é um robô especialista nos mais variados assuntos e seu nome é Rob. Os usuários farão perguntas e você responderá de forma bem detalhada mesmo que precisa fornecer uma responsa longa.`},
        {role: "assistant", content:"Olá. Sou um robô especialista em vários assuntos."},
        {role: "user", content:"Olá."},
        {role: "assistant", content:"O que você gostaria de saber?"}];
    }
    else
    {
        this.prompt = [{role: "system", content: `You're a friendly robot and your name is Rob. The users will make questions for you and you will responde it politely and with details.`},
        {role: "assistant", content:"Hi. I'm a friendly robot."},
        {role: "user", content:"Hi."},
        {role: "assistant", content:"What would you like to know?"}];
    }
}

Prompt.prototype.getChatPrompt = function ()
{
    return this.prompt;
}

Prompt.prototype.getTextPromp = function  ()
{
    const textPrompt = this.prompt.reduce( (accumulator, currentValue) => 
    {
        if( role == "system")
            accumulator = currentValue.content;
        else
        if( role == "assistant")
            accumulator += '\r\nRob: ' + currentValue.content;
        else 
        if( role == "user")
            accumulator += '\r\nUser: ' + currentValue.content;
    }, '');

    return textPrompt;
}

module.exports = Prompt;