import React, { useState } from "react";
import { FiSend } from "react-icons/fi";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { github } from "react-syntax-highlighter/dist/esm/styles/hljs";
import "./ChatInterface.css";

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Start Chat with me" },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage = { sender: "user", text: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setLoading(true);
    setElapsedTime(0);

    const startTime = Date.now();
    const timerId = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const res = await fetch("http://127.0.0.1:8000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: userMessage.text }),
      });
      const data = await res.json();

      let botMessage;
      if (data.error) {
        botMessage = { sender: "bot", text: "Error: " + data.error };
      } else {
        botMessage = {
          sender: "bot",
          code: data.code || "Không có code trả về",
        };
      }

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Lỗi kết nối: " + err.message },
      ]);
    } finally {
      clearInterval(timerId);
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className="chat-container">
      <div className="chat-box">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`message ${msg.sender === "user" ? "user" : "bot"}`}
          >
            {msg.code ? (
              <SyntaxHighlighter language="python" style={github}>
                {msg.code}
              </SyntaxHighlighter>
            ) : (
              msg.text
            )}
          </div>
        ))}
        {loading && (
          <div className="message bot">Đang suy nghĩ... {elapsedTime}s</div>
        )}
      </div>

      <div className="tin_nhan">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your instruction..."
        />
        <button onClick={handleSend}>
          <FiSend size={25} />
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
