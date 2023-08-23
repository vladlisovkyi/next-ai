import { ChatSidebar } from "components/ChatSidebar";
import Head from "next/head";
import { useEffect, useState } from "react";
import { streamReader } from "openai-edge-stream";
import { v4 as uuid } from "uuid";
import { Message } from "components/Message";
import { useRouter } from "next/router";
import { getSession } from "@auth0/nextjs-auth0";
import clientPromise from "lib/mongodb";
import { ObjectId } from "mongodb";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRobot } from "@fortawesome/free-solid-svg-icons";

export const getServerSideProps = async (context) => {
  const chatId = context.params?.chatId?.[0] || null;

  if (chatId) {
    let objectId;

    try {
      objectId = new ObjectId(chatId);
    } catch {
      return {
        redirect: {
          destination: "/chat",
        },
      };
    }

    const { user } = await getSession(context.req, context.res);
    const client = await clientPromise;
    const db = client.db("Chatgpt");
    const chat = await db.collection("chats").findOne({
      userId: user.sub,
      _id: objectId,
    });

    if (!chat) {
      return {
        redirect: {
          destination: "/chat",
        },
      };
    }

    return {
      props: {
        chatId,
        title: chat.title,
        messages: chat.messages.map((message) => ({ ...message, _id: uuid() })),
      },
    };
  }

  return {
    props: {},
  };
};

export default function ChatPage({ chatId, title, messages = [] }) {
  const [newChatId, setNewChatId] = useState(null);
  const [incomingMessage, setIncomingMessage] = useState("");
  const [fullMessage, setFullMessage] = useState("");
  const [messageText, setMessageText] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [generatingResponse, setGeneratingResponse] = useState(false);
  const [originalChatId, setOriginalChatId] = useState(chatId);
  const router = useRouter();
  const routeHasChanged = chatId !== originalChatId;

  useEffect(() => {
    setChatMessages([]);
    setNewChatId(null);
  }, [chatId]);

  useEffect(() => {
    if (!routeHasChanged && !generatingResponse && fullMessage) {
      setChatMessages((prevChatMessages) => [
        ...prevChatMessages,
        {
          _id: uuid(),
          role: "assistant",
          content: fullMessage,
        },
      ]);
      setFullMessage("");
    }
  }, [generatingResponse, fullMessage, routeHasChanged]);

  useEffect(() => {
    if (!generatingResponse && newChatId) {
      setNewChatId(null);
      router.push(`/chat/${newChatId}`);
    }
  }, [newChatId, generatingResponse, router]);

  const handleChange = (event) => {
    setMessageText(event.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!messageText.trim()) {
      return;
    }

    setGeneratingResponse(true);
    setOriginalChatId(chatId);
    setMessageText("");
    setChatMessages((prevChatMessages) => [
      ...prevChatMessages,
      {
        _id: uuid(),
        role: "user",
        content: messageText,
      },
    ]);

    const response = await fetch("/api/chat/send-message", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: messageText,
        chatId,
      }),
    });
    const data = response.body;

    if (!data) {
      return;
    }

    const reader = data.getReader();
    let content = "";

    await streamReader(reader, (message) => {
      if (message.event === "newChatId") {
        setNewChatId(message.content);
      } else {
        setIncomingMessage(
          (incomingMessage) => incomingMessage + message.content
        );
        content += message.content;
      }
    });

    setFullMessage(content);
    setIncomingMessage("");
    setGeneratingResponse(false);
  };

  const allChatMessages = [...messages, ...chatMessages];

  return (
    <>
      <Head>
        <title>New chat</title>
      </Head>
      <div className="grid h-screen grid-cols-[260px_1fr]">
        <ChatSidebar chatId={chatId} />
        <div className="flex flex-col overflow-hidden bg-gray-700">
          <div className="flex flex-1 flex-col-reverse overflow-y-scroll text-white">
            {allChatMessages.length ? (
              <div className="mb-auto">
                {allChatMessages.map((message) => (
                  <Message
                    key={message._id}
                    role={message.role}
                    content={message.content}
                  />
                ))}
                {incomingMessage && !routeHasChanged && (
                  <Message role="assistant" content={incomingMessage} />
                )}
                {incomingMessage && routeHasChanged && (
                  <Message
                    role="warning"
                    content="Only one message at a time. Please wait until other responses will complete before sending another message"
                  />
                )}
              </div>
            ) : !allChatMessages.length && !generatingResponse ? (
              <div className="m-auto flex items-center justify-center text-center">
                <div>
                  <FontAwesomeIcon
                    icon={faRobot}
                    className="text-6xl text-emerald-200"
                  />
                  <h1 className="mt-2 text-4xl font-bold text-white/50">
                    Ask me a question!
                  </h1>
                </div>
              </div>
            ) : (
              ""
            )}
          </div>
          <footer className="bg-gray-800 p-10">
            <form onSubmit={handleSubmit}>
              <fieldset className="flex gap-2" disabled={generatingResponse}>
                <textarea
                  value={messageText}
                  onChange={handleChange}
                  className="w-full resize-none rounded-md bg-gray-700 p-2 text-white focus:border-emerald-500 focus:bg-gray-600 focus:outline focus:outline-emerald-500"
                  placeholder={generatingResponse ? "" : "Send a message..."}
                ></textarea>
                <button type="submit" className="btn">
                  Send
                </button>
              </fieldset>
            </form>
          </footer>
        </div>
      </div>
    </>
  );
}
