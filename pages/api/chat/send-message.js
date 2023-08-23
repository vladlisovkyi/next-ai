import { OpenAIEdgeStream } from "openai-edge-stream";

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  if (req.method === "POST") {
    try {
      const { message, chatId: chatIdFromParam } = await req.json();

      if (!message || typeof message !== "string" || message.length > 200) {
        return new Response(
          {
            message: "Message is required and must be less than 200 characters",
          },
          {
            status: 422,
          }
        );
      }

      const initialChatMessage = {
        role: "system",
        content:
          "Your name is ChatGPT. An incredibly intelligent, friendly and quick-thinking AI, that always replies with enthusiastic and positive energy. You were created by Denys Kleimenov. Your response must be formatted as markdown.",
      };
      let chatId = chatIdFromParam;
      let newChatId;
      let chatMessages = [];

      if (chatIdFromParam) {
        const response = await fetch(
          req.headers.get("origin") + "/api/chat/add-message-to-chat",
          {
            method: "POST",
            headers: {
              "Content-type": "application/json",
              cookie: req.headers.get("cookie"),
            },
            body: JSON.stringify({
              chatId,
              role: "user",
              content: message,
            }),
          }
        );
        const data = await response.json();
        chatMessages = data.chat.messages || [];
      } else {
        const response = await fetch(
          req.headers.get("origin") + "/api/chat/create-new-chat",
          {
            method: "POST",
            headers: {
              "Content-type": "application/json",
              cookie: req.headers.get("cookie"),
            },
            body: JSON.stringify({
              message,
            }),
          }
        );
        const data = await response.json();
        chatId = data._id;
        newChatId = data._id;
        chatMessages = data.chat.messages || [];
      }

      const messagesToInclude = [];

      chatMessages.reverse();

      let usedTokens = 0;

      for (const chatMessage of chatMessages) {
        const messageTokens = chatMessage.content.length / 4;

        usedTokens += messageTokens;

        if (usedTokens <= 2000) {
          messagesToInclude.push(chatMessage);
        } else {
          break;
        }
      }

      messagesToInclude.reverse();

      const stream = await OpenAIEdgeStream(
        "https://api.openai.com/v1/chat/completions",
        {
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          method: "POST",
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [initialChatMessage, ...messagesToInclude],
            stream: true,
          }),
        },
        {
          onBeforeStream: ({ emit }) => {
            if (newChatId) {
              emit(chatId, "newChatId");
            }
          },
          onAfterStream: async ({ fullContent }) => {
            await fetch(
              `${req.headers.get("origin")}/api/chat/add-message-to-chat`,
              {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  cookie: req.headers.get("cookie"),
                },
                body: JSON.stringify({
                  chatId,
                  role: "assistant",
                  content: fullContent,
                }),
              }
            );
          },
        }
      );

      return new Response(stream);
    } catch (error) {
      return new Response(
        { message: "Couldn't send a request!" },
        { status: 500 }
      );
    }
  }
}
