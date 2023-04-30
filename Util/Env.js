require('dotenv').config()

function Env()
{
    this.OpenAIKey = process.env.OPENAI_KEY;
    this.DiscordToken = process.env.DISCORD_TOKEN;
    this.OpenAIOrganization = process.env.OPENAI_ORGANIZATION;
    this.TokenToReserveForCompletion = process.env.TOKENS_TO_RESERVE_FOR_COMPLETION;
    this.Debug = process.env.DEBUG === "true";
}

module.exports = Env;
