import React, { useEffect, useState } from 'react';

const ChatsList = () => {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const user = JSON.parse(localStorage.getItem('user'));
    const userId = user?.user_id;  // or user?._id depending on structure

    useEffect(() => {
        const fetchChats = async () => {
            try {
                const res = await fetch(`http://localhost:8000/get_user_chats/${userId}`);
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.detail || "Server error");
                }
                const data = await res.json();
                setChats(data.chats);

                console.log(data.chats)
                data.chats.forEach((c, i) => console.log(`Chat ${i + 1} Title:`, c.title));
            } catch (err) {
                setError(err.message || "Error fetching chats");
            } finally {
                setLoading(false);
            }
        };

        if (userId) fetchChats();
    }, [userId]);

    if (!userId) return <p className="text-red-500">User not logged in.</p>;
    if (loading) return <p>Loading chats...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-xl font-semibold">Your Chats</h2>
            {chats.length === 0 ? (
                <p className="text-gray-500">No chats found.</p>
            ) : (
                <ul className="space-y-2">
                    {chats.map((chat) => (
                        <li key={chat.chat_id} className="border p-3 rounded shadow-sm hover:shadow-md">
                            <div className="font-medium">{chat.title || 'Untitled Chat'}</div>
                            <div className="text-sm text-gray-500">Chat ID: {chat.chat_id}</div>
                            <div className='text-sm text-black'>
                                {chat.messages && chat.messages.length > 0 ? (
                                    chat.messages.map((msg, idx) => (
                                        <p key={idx}>{msg.content || JSON.stringify(msg)}</p>
                                    ))
                                ) : (
                                    <p>No messages</p>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ChatsList;