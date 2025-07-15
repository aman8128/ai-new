import React, { useState, useRef, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './home.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';

function Home() {
  // State management
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [chatToRename, setChatToRename] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState(null);
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const [downloadedCodeId, setDownloadedCodeId] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [tempTitle, setTempTitle] = useState('');
  const [renameSource, setRenameSource] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [Userinfo, setUserinfo] = useState([]);
  const [UserImage, SetUserImage] = useState();
  const navigate = useNavigate();
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [theme, setTheme] = useState('Dark');
  const [layout, setLayout] = useState('Normal');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [activeSettingsTab, setActiveSettingsTab] = useState('general');

  // General settings state
  const [generalSettings, setGeneralSettings] = useState({
    language: 'English',
    darkMode: true,
    fontSize: 'Medium'
  });

  // Profile settings state
  const [profileSettings, setProfileSettings] = useState({
    username: Userinfo?.username || '',
    email: Userinfo?.email || '',
    bio: ''
  });

  // Refs
  const messagesEndRef = useRef(null);
  const userId = useRef("user_" + Math.random().toString(36).substr(2, 9));
  const typingIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);
  const botMessageIdRef = useRef(null);
  const inputRef = useRef(null);
  const sidebarRef = useRef(null);
  const typingMessageId = useRef(null);
  const fileInputRef = useRef(null);
  const renameInputRef = useRef(null);
  const renameFormRef = useRef(null);
  const chatInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const customizeModalRef = useRef(null);
  const settingsModalRef = useRef(null);
  const helpModalRef = useRef(null);

  const user = JSON.parse(localStorage.getItem('user'));
  const user_id = user?.user_id;

  const TYPING_SPEED = 20; // milliseconds per character
  const MAX_IMAGES = 10;

  // Generate unique ID for messages
  const generateUniqueId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Effects
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      // Clean up object URLs
      selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
    };
  }, [selectedImages]);

  useEffect(() => {
    if (inputValue === '' && inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [inputValue]);


  useEffect(() => {
    // Focus input when not processing
    if (!isProcessing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isProcessing]);

  useEffect(() => {
    if (chatHistory.length === 0) {
      const defaultChat = {
        id: generateUniqueId(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString()
      };
      setChatHistory([defaultChat]);
      setActiveChat(defaultChat.id);
    }
  }, []);

  useEffect(() => {
    // Close sidebar when clicking outside
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        if (window.innerWidth < 768) {
          setIsSidebarVisible(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchuserinfo = async () => {
      try {
        const response = await fetch(`http://localhost:8000/get_user_info/${user_id}`)

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail || 'server error');
        }

        const data = await response.json();

        setUserinfo(data);
        console.log(data)

        SetUserImage(data.google_profile);

      } catch (e) {
        setError(e.message || 'Error fetching user info!')
      } finally {
        setLoading(false);
      }
    }
    if (user_id) fetchuserinfo();

  }, [user_id]);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await fetch(`http://localhost:8000/get_user_chats/${user_id}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Server error");
        }
        const data = await res.json();
        setChats(data.chats);

      } catch (err) {
        setError(err.message || "Error fetching chats");
      } finally {
        setLoading(false);
      }
    };

    if (user_id) fetchChats();
  }, [user_id]);

  if (!user_id) return <p className="text-red-500">User not logged in.</p>;
  if (loading) return <p>Loading chats...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Image handling functions
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const invalidFiles = files.filter(f => !validTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      toast.error(`Invalid file type: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      toast.error(`Files too large (max 5MB): ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    if (files.length + selectedImages.length > MAX_IMAGES) {
      toast.warn(`You can upload maximum ${MAX_IMAGES} images`);
      return;
    }

    const newImages = files.map(file => ({
      file,
      id: generateUniqueId(),
      preview: URL.createObjectURL(file)   // 👈 preview for local display only
    }));

    setSelectedImages(prev => [...prev, ...newImages]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // In your removeImage function
  const removeImage = (id) => {
    const imageToRemove = selectedImages.find(img => img.id === id);
    if (imageToRemove?.preview?.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    setSelectedImages(prev => prev.filter(img => img.id !== id));
  };

  const clearSelectedImages = () => {
    selectedImages.forEach(img => {
      if (img.preview?.startsWith('blob:')) {
        URL.revokeObjectURL(img.preview);
      }
    });
    setSelectedImages([]);
  };

  const uploadImages = async () => {
    if (selectedImages.length === 0) return null;

    setIsUploadingImages(true);
    try {
      const formData = new FormData();
      selectedImages.forEach((image) => {
        formData.append('images', image.file);
      });

      formData.append('user_id', user_id || userId.current);
      formData.append('chat_id', activeChat || 'default');
      if (inputValue.trim()) {
        formData.append('prompt', inputValue.trim());
      }

      const response = await fetch('http://localhost:8000/upload-image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || result.status === 'error') {
        throw new Error(result.error || 'Failed to upload images');
      }

      return result;
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error(error.message || 'Failed to upload images');
      return null;
    } finally {
      setIsUploadingImages(false);
    }
  };

  // Chat operations
  const generateChatTitle = (messages) => {
    const firstUserMessage = messages.find(msg => msg.sender === 'user');
    if (firstUserMessage) {
      const shortText = firstUserMessage.text
        .replace(/\n/g, ' ')
        .trim()
        .slice(0, 30);
      return shortText + (firstUserMessage.text.length > 30 ? '...' : '');
    }
    return `New Chat ${new Date().toLocaleTimeString()}`;
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 1000);
  };

  const handleRegenerate = (id) => {
    setRegeneratingMessageId(id);
    regenerateResponse(id);
    setTimeout(() => setRegeneratingMessageId(null), 1000);
  };

  const handleCopyCode = (content, id) => {
    navigator.clipboard.writeText(content);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 1000);
  };

  const handleDownloadCode = (content, lang, id) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-${lang || 'snippet'}.${lang || 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadedCodeId(id);
    setTimeout(() => setDownloadedCodeId(null), 1000);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const toggleSidebar = () => setIsSidebarVisible(!isSidebarVisible);

  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);

    if (typingMessageId.current) {
      setMessages(prev => prev.filter(msg => msg.id !== typingMessageId.current));
      typingMessageId.current = null;
    }

    botMessageIdRef.current = null;
    typingMessageId.current = null;
    setIsProcessing(false);
    setIsTyping(false);
    setMessages(prev => prev.filter(msg => msg.id !== typingMessageId.current));
  };

  const startNewChat = () => {
    if (isTyping || isProcessing) return;

    const emptyChat = chatHistory.find(chat => chat.messages.length === 0);
    if (emptyChat) {
      setActiveChat(emptyChat.id);
      setMessages([]);
    } else {
      const currentChat = chatHistory.find(chat => chat.id === activeChat);
      const hasBotMessage = messages.some(msg => msg.sender === 'bot');

      if (currentChat && hasBotMessage) {
        const updatedChat = {
          ...currentChat,
          messages: [...messages],
          title: currentChat.title === 'New Chat' ? generateChatTitle(messages) : currentChat.title,
          updatedAt: new Date().toISOString()
        };

        const updatedHistory = chatHistory.map(chat =>
          chat.id === activeChat ? updatedChat : chat
        );
        setChatHistory(updatedHistory);
      }

      const newChat = {
        id: generateUniqueId(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString()
      };
      setChatHistory(prev => [newChat, ...prev]);
      setMessages([]);
      setActiveChat(newChat.id);
    }
  };

  const loadChat = async (chat) => {
    try {
      // Transform messages to match frontend structure
      const transformedMessages = (chat.messages || []).flatMap(msg => {
        const messages = [];

        // Add user message
        if (msg.prompt) {
          messages.push({
            id: msg.message_id + '_user',
            text: msg.prompt,
            sender: 'user',
            timestamp: msg.timestamp
          });
        }
        // Add bot response
        if (msg.response) {
          messages.push({
            id: msg.message_id + '_bot',
            text: msg.response,
            sender: 'bot',
            timestamp: new Date(new Date(msg.timestamp).getTime() + 1000).toISOString()
          });
        }

        return messages;
      });

      setMessages(transformedMessages);
      setActiveChat(chat.chat_id);

      if (window.innerWidth < 768) {
        setIsSidebarVisible(false);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
      toast.error("Failed to load chat");
    }
  };

  const handleShare = async (chatId) => {
    const chat = chats.find(c => c.id || c.chat_id === chatId);

    if (!chat) return;

    try {
      const content = chat.messages.map(msg => {
        const promptText = msg.prompt ? `You: ${msg.prompt}` : '';
        const responseText = msg.response ? `Assistant: ${msg.response}` : '';
        return [promptText, responseText].filter(Boolean).join('\n');
      }).join('\n\n');


      await navigator.clipboard.writeText(content);
    } catch (err) {
      toast.error("Failed to copy chat");
      console.error('Failed to copy chat:', err);
    }
  };

  const confirmDelete = (chatId) => {
    setChatToDelete(chatId);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!chatToDelete) return;

    try {
      const response = await fetch('http://localhost:8000/delete-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          user_id: user_id,
          chat_id: chatToDelete,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete chat');
      }

      // Update local state immediately
      setChats(prev => prev.filter(chat => chat.chat_id !== chatToDelete));

      if (activeChat === chatToDelete) {
        setMessages([]);
        setActiveChat(null);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast.error("Failed to delete chat");
    } finally {
      setShowDeleteModal(false);
      setChatToDelete(null);
    }
  };

  const confirmRename = (chatId, currentTitle) => {
    setChatToRename(chatId);
    setNewChatTitle(currentTitle);
    setShowRenameModal(true);
  };

  const handleRenameInline = async (chatId) => {
    if (!tempTitle.trim()) {
      setEditingChatId(null);
      setTempTitle('');
      setRenameSource(null);
      return;
    }

    try {
      setChats(prev =>
        prev.map(chat =>
          chat.chat_id === chatId
            ? { ...chat, title: tempTitle.trim(), updatedAt: new Date().toISOString() }
            : chat
        )
      );

      await fetch('http://localhost:8000/rename-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          user_id: user_id,
          chat_id: chatId,
          new_title: tempTitle.trim(),
        }),
      });

    } catch (err) {
      console.error('Rename failed:', err);
      toast.error("Rename failed");
      // Revert local changes if API fails
      setChats(prev => prev.map(chat =>
        chat.chat_id === chatId
          ? { ...chat, title: chat.title } // revert to original title
          : chat
      ));
    }

    setEditingChatId(null);
    setTempTitle('');
    setRenameSource(null);
  };

  const updateChatHistory = (userMessage, botMessage, title) => {
    if (!activeChat) {
      const newChat = {
        id: generateUniqueId(),
        title,
        messages: [userMessage, botMessage],
        createdAt: new Date().toISOString()
      };
      setChatHistory(prev => [newChat, ...prev]);
      setActiveChat(newChat.id);
    } else {
      setChatHistory(prev =>
        prev.map(chat =>
          chat.id === activeChat
            ? {
              ...chat,
              title: chat.title === 'New Chat' ? title : chat.title,
              messages: [...chat.messages, userMessage, botMessage],
              updatedAt: new Date().toISOString()
            }
            : chat
        )
      );
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch(`http://localhost:8000/get_user_chats/${user_id}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Server error");
      }
      const data = await res.json();
      setChats(data.chats);

      // If there's a new chat, set it as active
      if (data.chats.length > 0 && !activeChat) {
        setActiveChat(data.chats[0].chat_id);
      }
    } catch (err) {
      setError(err.message || "Error fetching chats");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputValue.trim() && selectedImages.length === 0) || isProcessing) return;

    const userMessageText = inputValue.trim() || (selectedImages.length > 0 ? "Analyze these images" : "");
    if (!userMessageText) return;

    // Create user message
    const userMessage = {
      id: generateUniqueId(),
      text: userMessageText,
      type: selectedImages.length > 0 ? 'image-upload' : 'text',
      sender: 'user',
      timestamp: new Date().toISOString(),
      images: selectedImages.map(img => img.preview) || []
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    if (selectedImages.length > 0) clearSelectedImages();

    setIsProcessing(true);
    setIsTyping(true);

    // Add typing indicator
    const typingMessageId = generateUniqueId();
    setMessages(prev => [...prev, {
      id: typingMessageId,
      type: 'typing',
      sender: 'bot',
      text: '',
      timestamp: new Date().toISOString()
    }]);

    abortControllerRef.current = new AbortController();
    const title = generateChatTitle([userMessage]);

    try {
      let response;

      if (selectedImages.length > 0) {
        const uploadResponse = await uploadImages();
        if (!uploadResponse) throw new Error('Image upload failed');

        userMessage.image_urls = uploadResponse.image_urls;
        const responseText = uploadResponse.llm_responses?.[0] || "Image processed";

        // Remove typing indicator and add bot message
        setMessages(prev => prev.filter(msg => msg.id !== typingMessageId));

        const botMessageId = generateUniqueId();
        botMessageIdRef.current = botMessageId;

        setMessages(prev => [...prev, {
          id: botMessageId,
          type: 'text',
          sender: 'bot',
          text: '',
          timestamp: new Date().toISOString()
        }]);

        // Typing effect for bot response
        let currentIndex = 0;
        typingIntervalRef.current = setInterval(() => {
          if (currentIndex < responseText.length) {
            setMessages(prev => prev.map(msg =>
              msg.id === botMessageId
                ? { ...msg, text: responseText.substring(0, currentIndex + 1) }
                : msg
            ));
            currentIndex++;
          } else {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
            botMessageIdRef.current = null;
            setIsTyping(false);

            const finalMessage = {
              id: botMessageId,
              type: 'text',
              sender: 'bot',
              text: responseText,
              timestamp: new Date().toISOString()
            };

            updateChatHistory(userMessage, finalMessage, title);

            // Update the chats list in the sidebar
            fetchChats(); // Add this line to refresh the chat list
          }
        }, TYPING_SPEED);
        return;
      }

      // Handle text message
      response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          prompt: userMessageText,
          user_id: user_id,
          chat_id: activeChat,
          title: title
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();

      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.id !== typingMessageId));

      const responseText = data.response || data.content || "I didn't understand that";
      const botMessageId = generateUniqueId();
      botMessageIdRef.current = botMessageId;

      // Add empty bot message
      setMessages(prev => [...prev, {
        id: botMessageId,
        type: 'text',
        sender: 'bot',
        text: '',
        timestamp: new Date().toISOString()
      }]);

      // Typing effect
      let currentIndex = 0;
      typingIntervalRef.current = setInterval(() => {
        if (currentIndex < responseText.length) {
          setMessages(prev => prev.map(msg =>
            msg.id === botMessageId
              ? { ...msg, text: responseText.substring(0, currentIndex + 1) }
              : msg
          ));
          currentIndex++;
        } else {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
          botMessageIdRef.current = null;
          setIsTyping(false);

          const finalMessage = {
            id: botMessageId,
            type: 'text',
            sender: 'bot',
            text: responseText,
            timestamp: new Date().toISOString()
          };

          updateChatHistory(userMessage, finalMessage, title);

          // Update the chats list in the sidebar
          fetchChats(); // Add this line to refresh the chat list
        }
      }, TYPING_SPEED);

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error:', err);
        setMessages(prev => [...prev.filter(msg => msg.id !== typingMessageId), {
          id: generateUniqueId(),
          type: 'text',
          sender: 'bot',
          text: 'Error: Could not get response. Please try again.',
          timestamp: new Date().toISOString()
        }]);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const regenerateResponse = async (messageId) => {
    const messageToRegenerate = messages.find(msg => msg.id === messageId);
    if (!messageToRegenerate || messageToRegenerate.sender !== 'bot') return;

    // Find the previous user message that triggered this bot response
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    const previousUserMessage = messages[messageIndex - 1];

    if (!previousUserMessage || previousUserMessage.sender !== 'user') return;

    // Remove the old bot response
    setMessages(prev => prev.filter(msg => msg.id !== messageId));

    // Create new typing indicator
    const typingMessageId = generateUniqueId();
    setMessages(prev => [...prev, {
      id: typingMessageId,
      type: 'typing',
      sender: 'bot',
      text: '',
      timestamp: new Date().toISOString()
    }]);

    setIsProcessing(true);
    setIsTyping(true);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          prompt: previousUserMessage.text,
          user_id: user_id || userId.current,
          chat_id: activeChat,
          title: chats.find(c => c.chat_id === activeChat)?.title || 'New Chat',
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();
      setMessages(prev => prev.filter(msg => msg.id !== typingMessageId));

      if (data.type === "image") {
        const botMessage = {
          id: generateUniqueId(),
          type: 'image',
          sender: 'bot',
          text: data.description || "Generated image",
          image_url: data.image_url,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, botMessage]);

        setIsProcessing(false);
        setIsTyping(false);
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        if (abortControllerRef.current) abortControllerRef.current = null;
      } else {
        const responseText = data.content || JSON.stringify(data);
        const botMessageId = generateUniqueId();

        // Typing effect for the new response
        let currentIndex = 0;
        typingIntervalRef.current = setInterval(() => {
          if (currentIndex < responseText.length) {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === botMessageId
                  ? { ...msg, text: responseText.substring(0, currentIndex + 1) }
                  : msg
              )
            );
            currentIndex++;
          } else {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
            setIsTyping(false);
          }
        }, TYPING_SPEED);

        setMessages(prev => [...prev, {
          id: botMessageId,
          type: 'text',
          sender: 'bot',
          text: '',
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error:', err);
        setMessages(prev => [...prev, {
          id: generateUniqueId(),
          type: 'text',
          sender: 'bot',
          text: 'Error: Could not regenerate response. Please try again.',
          timestamp: new Date().toISOString()
        }]);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const formatMessageContent = (text, type = 'text') => {
    if (!text) return null;

    if (type === 'image') {
      return (
        <div className="generated-image-container">
          <img
            src={`http://localhost:8000${text}`}
            alt="Generated content"
            className="img-fluid rounded"
            style={{ maxHeight: '300px', maxWidth: '100%' }}
            onError={e => {
              e.target.onerror = null;
              e.target.src = '/placeholder-image.png';
            }}
          />
        </div>
      );
    }

    // Markdown inline formatting
    const processText = content => {
      if (!content) return '';
      let processed = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');
      processed = processed.replace(/`(.+?)`/g, '<code class="inline-code">$1</code>');
      return processed;
    };

    // Parse the content into blocks
    const blocks = [];
    const lines = text.split('\n');
    let inCode = false;
    let codeLang = '';
    let codeLines = [];
    let textLines = [];

    const pushTextBlock = () => {
      if (textLines.length > 0) {
        blocks.push({
          type: 'text',
          content: textLines.join('\n'),
        });
        textLines = [];
      }
    };

    lines.forEach((line) => {
      if (line.startsWith('```')) {
        if (!inCode) {
          // Starting a code block
          pushTextBlock();
          inCode = true;
          codeLang = line.replace('```', '').trim();
          codeLines = [];
        } else {
          // Ending a code block
          inCode = false;
          blocks.push({
            type: 'code',
            lang: codeLang,
            content: codeLines.join('\n'),
          });
          codeLang = '';
          codeLines = [];
        }
      } else if (inCode) {
        codeLines.push(line);
      } else {
        textLines.push(line);
      }
    });

    // Push any remaining blocks after loop
    pushTextBlock();
    if (codeLines.length > 0) {
      blocks.push({
        type: 'code',
        lang: codeLang,
        content: codeLines.join('\n'),
      });
    }

    // Render blocks with proper keys
    return (
      <div className="message-content">
        {blocks.map((block, index) => {
          if (block.type === 'code') {
            return (
              <div key={`code-${index}`} className="code-block-container position-relative mb-3">
                <div className="code-block bg-dark text-light p-3 rounded">
                  {block.lang && (
                    <div className="text-muted mb-2 font-monospace small">{block.lang}</div>
                  )}
                  <pre className="m-0">
                    <code className={`language-${block.lang || 'plaintext'}`}>
                      {block.content}
                    </code>
                  </pre>
                </div>
                <div className="code-actions position-absolute top-0 end-0 p-2 d-flex gap-1">
                  <button
                    className="btn btn-sm buttonn1"
                    onClick={() => handleCopyCode(block.content, block.id)}
                    title="Copy code"
                  >
                    <i className={copiedCodeId === block.id ? "bi bi-clipboard-check" : "bi bi-copy"}></i>
                    <span>
                      {copiedCodeId === block.id ? "  Copied" : "  Copy"}
                    </span>
                  </button>
                  <button
                    className="btn btn-sm buttonn1"
                    onClick={() => handleDownloadCode(block.content, block.lang, block.id)}
                    title="Download code"
                  >
                    <i className={downloadedCodeId === block.id ? "bi bi-check-square" : "bi bi-download"}></i>
                    <span>
                      {downloadedCodeId === block.id ? "  Downloaded" : "  Download"}
                    </span>
                  </button>
                </div>
              </div>
            );
          }

          // Process text blocks
          const paragraphs = block.content.split(/\n\s*\n/);
          return paragraphs
            .filter(p => p.trim())
            .map((paragraph, pIdx) => {
              const p = paragraph.trim();

              // Headings
              if (p.startsWith('### ')) {
                return (
                  <h1
                    key={`h1-${index}-${pIdx}`}
                    className="message-heading"
                    dangerouslySetInnerHTML={{ __html: processText(p.replace(/^### /, '')) }}
                  />
                );
              }
              if (p.startsWith('## ')) {
                return (
                  <h3
                    key={`h3-${index}-${pIdx}`}
                    className="message-heading"
                    dangerouslySetInnerHTML={{ __html: processText(p.replace(/^## /, '')) }}
                  />
                );
              }
              if (p.startsWith('# ')) {
                return (
                  <h3
                    key={`h3-${index}-${pIdx}`}
                    className="message-heading"
                    dangerouslySetInnerHTML={{ __html: processText(p.replace(/^# /, '')) }}
                  />
                );
              }

              // Lists
              if (p.startsWith('- ') || p.startsWith('* ')) {
                const items = p.split('\n');
                return (
                  <ul key={`ul-${index}-${pIdx}`} className="message-list">
                    {items.map((item, i) => (
                      <li
                        key={`li-${i}`}
                        dangerouslySetInnerHTML={{
                          __html: processText(item.replace(/^[-*] /, ''))
                        }}
                      />
                    ))}
                  </ul>
                );
              }

              if (/^\d+\.\s/.test(p)) {
                const items = p.split('\n');
                return (
                  <ol key={`ol-${index}-${pIdx}`} className="message-list">
                    {items.map((item, i) => (
                      <li
                        key={`li-${i}`}
                        dangerouslySetInnerHTML={{
                          __html: processText(item.replace(/^\d+\.\s/, ''))
                        }}
                      />
                    ))}
                  </ol>
                );
              }

              // Normal paragraph
              return (
                <p
                  key={`p-${index}-${pIdx}`}
                  className="message-paragraph"
                  dangerouslySetInnerHTML={{ __html: processText(p) }}
                />
              );
            });
        })}
      </div>
    );
  };

  const highlightSearchMatch = (text, query) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ?
        <span key={i} className="text-danger fw-bold">{part}</span> :
        part
    );
  };

  const filteredChats = (chatList) => {
    if (!searchQuery) {
      return chatList.map(chat => ({
        ...chat,
        highlightedMessages: [], // Add empty array if no search
      }));
    }

    return chatList.filter(chat => {
      const titleMatch = chat.title?.toLowerCase().includes(searchQuery.toLowerCase());

      const messagesMatch = chat.messages?.some(msg => {
        return (
          (msg.prompt?.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (msg.response?.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      });

      return titleMatch || messagesMatch;
    }).map(chat => ({
      ...chat,
      highlightedTitle: highlightSearchMatch(chat.title || "", searchQuery),
      highlightedMessages: chat.messages?.map(msg => ({
        ...msg,
        highlightedPrompt: msg.prompt ? highlightSearchMatch(msg.prompt, searchQuery) : "",
        highlightedResponse: msg.response ? highlightSearchMatch(msg.response, searchQuery) : ""
      })) || []
    }));
  };

  const renderMessageContent = (msg) => {
    const messageText = msg.text || '';

    switch (msg.type) {
      case 'typing':
        return (
          <div className="d-flex align-items-center gap-2">
            <div className="spinner-grow spinner-grow-sm text-light" role="status" />
          </div>
        );

      case 'image':
        return (
          <div className="message-content">
            <div className="bot-message">
              <img
                src={`http://localhost:8000${msg.image_url}`}
                alt={messageText}
                className="img-fluid rounded"
                style={{ maxHeight: '300px' }}
              />
              <p className="mt-2 mb-0">{messageText}</p>
            </div>
          </div>
        );

      case 'image-upload':
        return (
          <div className="message-content d-flex flex-column gap-2">
            {/* Render all images if present */}
            {Array.isArray(msg.image_urls) && msg.image_urls.length > 0 && (
              <div className="d-flex flex-wrap gap-2">
                {msg.image_urls.map((url, idx) => (
                  <div
                    key={idx}
                    style={{ width: '70px', height: '70px', borderRadius: '6px', overflow: 'hidden' }}
                  >
                    <img
                      src={`http://localhost:8000${url}`}
                      alt={`Uploaded ${idx}`}
                      className="img-fluid w-100 h-100 object-fit-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'placeholder-image-url'; // 👈 Replace this with your placeholder
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* TEXT below image, if exists */}
            {msg.text && (
              <p className="m-0" style={{ fontSize: '0.95rem', lineHeight: '1.5', color: '#ffffff' }}>
                {msg.text}
              </p>
            )}
          </div>

        );

      default:
        return (
          <div className="message-content">
            {msg.sender === 'bot' ? (
              <div className="bot-message">
                {formatMessageContent(msg.text, msg.type)}
              </div>
            ) : (
              <div className="user-message">
                {msg.text.split('\n').map((line, i) => <p key={i} className="mb-0">{line}</p>)}
              </div>
            )}
          </div>
        );
    }
  };

  const renderMessages = () => (
    <main className="flex-grow-1 overflow-auto p-3 bg-color1">
      <div className="d-flex flex-column gap-3">
        {messages.length === 0 ? (
          <div className="text-center mt-5">
            <div className="mb-4">
              <i className="bi bi-chat-square-text bg-color2 fs-1"></i>
            </div>
            <h5 className="bg-color2">Start a new conversation</h5>
            <p className="bg-color2">
              {selectedImages.length > 0 ?
                "You've selected images - add a message or send as is" :
                "Type a message below to begin chatting"}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.message_id}
              className={`d-flex flex-column ${msg.sender === 'user' ? 'align-items-end' : 'align-items-start'
                }`}
            >
              <div
                className={`message-container p-3 rounded-3 ${msg.sender === 'user' ?
                  'primary text-white' :
                  msg.type === 'typing' ?
                    'shadow' :
                    'text-dark shadow-sm shadow'
                  }`}
                style={{ maxWidth: '85%' }}
              >
                {renderMessageContent(msg)}

                <div className="text-start mt-1">
                  <small className={`text-opacity-75 ${msg.sender === 'user' ? 'text-white' : ''
                    }`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </small>
                </div>
              </div>

              {msg.sender === 'bot' && msg.type !== 'typing' && !isProcessing && !isTyping && (
                <div className="d-flex justify-content-start gap-2 mt-1 ms-3" style={{ maxWidth: '75%' }}>
                  <button
                    className="btn btn-sm buttonn"
                    onClick={() => handleCopy(msg.text, msg.id)}
                    title="Copy message"
                  >
                    <i className={copiedMessageId === msg.id ? "bi bi-clipboard-check" : "bi bi-copy"}></i>
                  </button>
                  <button
                    className="btn btn-sm buttonn"
                    onClick={() => handleRegenerate(msg.id)}
                    title="Regenerate response"
                    disabled={regeneratingMessageId === msg.id}
                  >
                    <i className={regeneratingMessageId === msg.id ? "bi bi-check" : "bi bi-arrow-repeat"}></i>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </main>
  );

  const renderInputArea = () => (
    <footer className="bg-color1 py-3 d-flex justify-content-center">
      <form onSubmit={handleSendMessage} style={{ width: '100%', maxWidth: '760px' }}>
        <div className="d-flex overflow-auto pb-2" style={{ gap: '8px' }}>
          {selectedImages.map((image) => (
            <div key={image.id} className="position-relative flex-shrink-0">
              <img
                src={image.preview}
                alt={`Preview ${image.id}`}
                style={{
                  height: '50px',
                  width: '50px',
                  objectFit: 'cover',
                  borderRadius: '4px'
                }}
              />
              <button
                type="button"
                onClick={() => removeImage(image.id)}
                aria-label="Remove image"
                className="btn btn-sm btn-danger p-0 d-flex align-items-center justify-content-center"
                style={{
                  position: 'absolute',
                  top: '-1px',
                  right: '-8px',
                  width: '15px',
                  height: '15px',
                  borderRadius: '50%'
                }}
              >
                <i className="bi bi-x" style={{ fontSize: '0.7rem' }}></i>
              </button>
            </div>
          ))}
        </div>
        <div
          className="shadow-sm px-3 py-3"
          style={{
            backgroundColor: 'rgb(80, 78, 78)',
            borderRadius: '30px',
            color: 'white',
            boxShadow: '12px 4px 4px 12px rgba(0, 0, 0, 0.17)',
          }}
        >
          {/* Image preview section */}
          {selectedImages.length > 0 && (
            <div className="mb-2">
              <div className="d-flex  justify-content-between align-items-center mb-2">
                <small className="text-muted">
                  {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
                </small>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={clearSelectedImages}
                >
                  Clear all
                </button>
              </div>

            </div>
          )}

          {/* Text input */}
          <textarea
            rows={1}
            className="form-control bg-transparent text-light ps-3 pt-2"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !(isProcessing || isTyping)) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder={
              selectedImages.length > 0 ?
                "Add a message about these images (optional)" :
                "Type your message..."
            }
            ref={inputRef}
            style={{
              resize: 'none',
              border: 'none',
              boxShadow: 'none',
              minHeight: '44px',
              maxHeight: '180px',
              overflowY: 'auto',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '1rem',
            }}
          />

          {/* Input actions */}
          <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
            <div className="d-flex align-items-center gap-3">
              <div className="position-relative">
                <input
                  type="file"
                  id="image-upload"
                  ref={fileInputRef}
                  accept="image/*"
                  className="d-none"
                  onChange={handleImageUpload}
                  multiple
                  disabled={selectedImages.length >= MAX_IMAGES}
                />
                <label
                  htmlFor="image-upload"
                  className={`btn btn-sm ${selectedImages.length >= MAX_IMAGES ? 'btn-outline-secondary disabled' : 'color-3'}`}
                  title={selectedImages.length >= MAX_IMAGES ?
                    `Maximum ${MAX_IMAGES} images allowed` : ""}
                >
                  <i className="bi bi-images me-1"></i>
                  {selectedImages.length > 0 ?
                    `${selectedImages.length}/${MAX_IMAGES}` : ''}
                </label>
              </div>
            </div>

            <button
              type="submit"
              onClick={cancelRequest}
              className={`btn rounded-pill px-4 d-flex align-items-center gap-2 ${isProcessing || isTyping || isUploadingImages ?
                'color-4' : 'color-4'
                }`}
            >

              {(isProcessing || isTyping || isUploadingImages) ? (
                <>
                  <span className="spinner-border spinner-border-sm spinner text-light" role="status" />
                </>
              ) : (
                <>
                  <i className="bi bi-send"></i>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="text-center mt-2">
          <small className="text-white">
            {isProcessing || isTyping || isUploadingImages ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={cancelRequest}
              >
                <i className="bi bi-stop-circle me-1"></i> Stop generating
              </button>
            ) : (
              'Press Enter to send, Shift+Enter for new line'
            )}
          </small>
        </div>
      </form>
    </footer>
  );

  return (
    <div className="d-flex vh-100">
      {/* Delete Confirmation Modal */}
      <div className={`modal fade ${showDeleteModal ? 'show' : ''}`}
        style={{ display: showDeleteModal ? 'block' : 'none' }}
        tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Confirm Deletion</h5>
              <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this chat? This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                <i className="bi bi-trash me-1"></i> Delete
              </button>
            </div>
          </div>
        </div>
      </div>
      {showDeleteModal && <div className="modal-backdrop fade show"></div>}

      {/* Search Modal */}
      <div className={`modal fade ${showSearchModal ? 'show' : ''}`}
        style={{
          display: showSearchModal ? 'block' : 'none',
          background: 'rgba(26, 25, 25, 0.6)'
        }}
        tabIndex="-1"
        onClick={(e) => {
          // Close modal when clicking outside the modal content
          if (e.target === e.currentTarget) {
            setShowSearchModal(false);
          }
        }}
      >
        <div className="modal-dialog modal-dialog-centered justify-content-between align-items-center" style={{ maxWidth: '650px' }}>
          <div className="modal-content bg-color3 rounded-3 pb-3" style={{
            border: 'none',
            boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="modal-header border-0">
              <div className="w-100">
                <div className="input-group">
                  <span className="input-group-text bg-transparent border-0">
                    <i className="bi bi-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-0 shadow-none"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    ref={searchInputRef}
                    style={{
                      fontSize: '1rem',
                      padding: '0.75rem 0',
                      backgroundColor: 'transparent'
                    }}
                  />
                  <button
                    className="input-group-text bg-transparent border-0"
                    type="button"
                    onClick={() => setShowSearchModal(false)}
                    style={{ cursor: 'pointer' }}
                  >
                    <i className="bi bi-x-lg bg-change"></i>
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-body p-0">
              <div
                className="search-results"
                style={{
                  maxHeight: '60vh',
                  overflowY: 'auto',
                  padding: '0 1rem',
                }}
              >
                {filteredChats(chats).length === 0 ? (
                  <div className="text-muted text-center py-4">
                    <i className="bi bi-search fs-4 mb-2 d-block"></i>
                    No chats found
                  </div>
                ) : (
                  <div className="list-group list-group-flush">
                    {filteredChats(chats).map((chat) => (
                      <div
                        key={chat.chat_id}
                        className={`list-group-item list-group-item-action px-3 py-3 border-0 rounded-3 mb-1 ${activeChat === chat.chat_id ? 'active' : ''
                          }`}
                        style={{
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                        }}
                        onClick={() => {
                          loadChat(chat);
                          setShowSearchModal(false);
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <strong className="text-truncate">
                            {chat.highlightedTitle || chat.title}
                          </strong>
                          <small className="text-muted ms-2">
                            {formatDate(chat.updated_at || chat.created_at)}
                          </small>
                        </div>

                        {/* Message preview */}
                        {(chat.highlightedMessages || []).slice(0, 1).map((msg, idx) => (
                          <div
                            key={idx}
                            className="text-muted small mt-2"
                            style={{
                              maxHeight: '3rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {msg.prompt && (
                              <div>
                                <span className="fw-semibold">You:</span>{' '}
                                {msg.highlightedPrompt || msg.prompt}
                              </div>
                            )}
                            {msg.response && (
                              <div>
                                <span className="fw-semibold">Assistant:</span>{' '}
                                {msg.highlightedResponse || msg.response}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {showSearchModal && <div className="modal-backdrop fade show"></div>}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`sidebar shadow-sm d-flex flex-column ${isSidebarVisible ? 'visible' : 'hidden'}`}
      >
        {/* --- Sticky Header Section --- */}
        <div className="sticky-top z-3">
          {/* Close Button */}
          <div className="d-flex justify-content-between align-items-center px-3 pt-3">
            <div className="fw-bold fs-6 text-white"></div>

            {isSidebarVisible && (
              <button
                className="btn color-6 btn-sm"
                onClick={toggleSidebar}
                aria-label="Close sidebar"
                style={{ lineHeight: '1' }}
                title="close sidebar"
              >
                <i className="bi bi-layout-sidebar-inset-reverse"></i>
              </button>
            )}
          </div>

          {/* New Chat Button */}
          <div className="d-flex px-2 pt-3">
            <button
              onClick={startNewChat}
              className="btn btn-outline-secondary border-0 text-start d-flex gap-2 w-100"
              disabled={isTyping || isProcessing}
            >
              <i className="fa-regular fa-pen-to-square pt-1"></i>
              <span className="text-truncate">New Chat</span>
            </button>
          </div>

          {/* Search Button */}
          <div className="p-2">
            <div className="input-group">
              <button
                className="btn btn-outline-secondary w-100 border-0 text-start d-flex"
                onClick={() => setShowSearchModal(true)}
              >
                <i className="bi bi-search me-2"></i>
                <span className="text-truncate">Search chats</span>
              </button>
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-center mb-0 ms-3">
            <h6 className="text-muted mb-2">Recent chats</h6>
          </div>
        </div>

        {/* --- Scrollable Chat List Section --- */}
        <div className="flex-grow-1 overflow-auto px-3 pt-2">

          <div className="list-group list-group-flush chat-list" style={{ paddingBottom: '1rem' }}>
            {chats.length === 0 ? (
              <div className="text-muted p-3 text-center">
                <i className="bi bi-chat-square-text fs-4 mb-2 d-block"></i>
                No active chats found
              </div>
            ) : (
              chats
                .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
                .map(chat => (
                  <div
                    key={chat.chat_id}
                    className={`list-group-item list-group-item-action border-0 px-3 py-2 ${activeChat === chat.chat_id ? 'active' : ''}`}
                    onClick={() => {
                      loadChat(chat);
                      setShowSearchModal(false);
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
                        <div
                          style={{
                            maxWidth: '180px',
                            height: '1.5rem',
                            lineHeight: '1.5rem',
                            fontSize: '0.95rem',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          onClick={(e) => {
                            if (!editingChatId) return;
                            e.stopPropagation();
                          }}
                        >
                          {editingChatId === chat.chat_id && renameSource === 'sidebar' ? (
                            <input
                              ref={renameInputRef}
                              type="text"
                              className="form-control form-control-sm fw-semibold border-0 p-0 m-0"
                              style={{
                                height: '1.5rem',
                                lineHeight: '1.5rem',
                                fontSize: '0.95rem',
                                backgroundColor: 'transparent',
                                boxShadow: 'none',
                              }}
                              value={tempTitle}
                              onChange={(e) => setTempTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameInline(chat.chat_id);
                                if (e.key === 'Escape') {
                                  setEditingChatId(null);
                                  setTempTitle('');
                                }
                              }}
                              onBlur={() => handleRenameInline(chat.chat_id)}
                              autoFocus
                            />
                          ) : (
                            <span
                              className="text-truncate text-start fw-semibold"
                              style={{
                                maxWidth: '100%',
                                cursor: 'pointer',
                                flex: 1,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {chat.highlightedTitle || chat.title}
                            </span>
                          )}
                          <small className="text-muted" style={{
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                            marginLeft: 'auto', // This will push it to the right
                          }}>
                            {formatDate(chat.updated_at || chat.created_at)}
                          </small>
                        </div>
                      </div>

                      {!editingChatId && (
                        <div className="dropdown">
                          <button
                            className="btn btn-sm border-0 p-0 d-flex align-items-center justify-content-center chat-menu-trigger"
                            type="button"
                            data-bs-toggle="dropdown"
                            aria-expanded="false"
                            style={{ width: '24px', height: '24px' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="d-flex gap-1 color-7">
                              <span className="rounded-circle bg-secondary" style={{ width: '4px', height: '4px' }}></span>
                              <span className="rounded-circle bg-secondary" style={{ width: '4px', height: '4px' }}></span>
                              <span className="rounded-circle bg-secondary" style={{ width: '4px', height: '4px' }}></span>
                            </div>
                          </button>
                          <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                            <li>
                              <button
                                className="dropdown-item text-light"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingChatId(chat.chat_id);
                                  setTempTitle(chat.title);
                                  setRenameSource('sidebar');
                                  setTimeout(() => {
                                    renameInputRef.current?.focus();
                                  }, 0);
                                }}
                              >
                                <i className="bi bi-pencil me-2"></i>Rename
                              </button>
                            </li>
                            <li>
                              <button
                                className="dropdown-item text-light"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleShare(chat.chat_id);
                                }}
                              >
                                <i className="bi bi-share me-2"></i>Share
                              </button>
                            </li>
                            <li><hr className="dropdown-divider" /></li>
                            <li>
                              <button
                                className="dropdown-item text-danger"
                                onClick={(e) => {
                                  e.preventDefault();
                                  confirmDelete(chat.chat_id);
                                }}
                              >
                                <i className="bi bi-trash me-2"></i>Delete
                              </button>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-grow-1 d-flex flex-column ${isSidebarVisible ? 'ms-sidebar' : 'ms-collapsed-sidebar'}`}>
        {/* Header */}
        <header className="bg-color p-4 d-flex align-items-center justify-content-between sticky-top">
          {!isSidebarVisible && (
            <div className="collapsed-sidebar d-flex flex-column align-items-center py-3 ">
              <button
                className="btn btn-sm color-5 "
                onClick={toggleSidebar}
                aria-label="Open sidebar"
                title='open sidebar'
              >
                <i className="bi bi-layout-sidebar-inset"></i>
              </button>

              <button
                onClick={startNewChat}
                className="btn btn-outline-secondary border-0 mt-5"
                disabled={isTyping || isProcessing}
              >
                <i className="fa-regular fa-pen-to-square "></i>
              </button>

              <button
                className="btn btn-outline-secondary border-0 mt-2"
                onClick={() => setShowSearchModal(true)}
              >
                <i className="bi bi-search "></i>
              </button>
            </div>
          )}

          <div className="d-flex justify-content-center align-items-center flex-grow-1">
            {editingChatId === activeChat && renameSource === 'header' ? (
              <input
                ref={renameInputRef}
                className="form-control text-center fw-semibold border-0"
                style={{
                  maxWidth: '360px',
                  height: '2.5rem',
                  fontSize: '1.5rem',
                  borderRadius: '8px',
                  padding: '0.25rem 0.75rem',
                  boxShadow: '0 0 0 0.15rem rgba(13,110,253,.25)',
                  transition: 'box-shadow 0.2s ease',
                }}
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameInline(activeChat);
                  if (e.key === 'Escape') {
                    setEditingChatId(null);
                    setTempTitle('');
                  }
                }}
                onBlur={() => handleRenameInline(activeChat)}
                autoFocus
              />
            ) : (
              <h4
                className="mb-0 fw-semibold color-9 text-truncate text-center"
                onClick={() => {
                  const found = chats.find(c => c.chat_id === activeChat);
                  if (found) {
                    setEditingChatId(activeChat);
                    setTempTitle(found.title);
                    setRenameSource('header');
                    setTimeout(() => renameInputRef.current?.focus(), 0);
                  }
                }}
                style={{
                  maxWidth: '360px',
                  width: '100%',
                  height: '2.5rem',
                  lineHeight: '2.5rem',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0 0.75rem',
                  borderRadius: '8px',
                }}
              >
                {chats.find(c => c.chat_id === activeChat)?.title || 'New Chat'}
              </h4>
            )}
            <div className="dropdown" style={{ position: 'absolute', top: 10, right: 10 }}>
              <button
                className="btn hover-1 mt-2 d-flex align-items-center justify-content-center"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                {UserImage?.picture_url ? (
                  <img
                    src={UserImage.picture_url}
                    alt="Profile"
                    className="rounded-circle"
                    style={{
                      width: '32px',
                      height: '32px',
                      objectFit: 'cover',
                    }}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = ''; // fallback to show letter avatar
                    }}
                  />
                ) : (
                  <span
                    className="rounded-circle text-white fw-semibold"
                    style={{
                      width: '32px',
                      height: '32px',
                      fontSize: '0.9rem',
                      backgroundColor: '#6c757d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      userSelect: 'none',
                    }}
                  >
                    {Userinfo?.username?.[0]?.toUpperCase() || 'U'}
                  </span>
                )}
              </button>

              <ul className="dropdown-menu dropdown-menu-end" style={{
                backgroundColor: '#2d2d2d',
                border: 'none',
                minWidth: '220px',
                borderRadius: '12px',
                padding: '8px 0',
                boxShadow: '0 0.5rem 1rem rgba(0,0,0,0.4)'
              }}>
                <li className="px-3 py-1 text-muted" style={{ fontSize: '0.875rem' }}>
                  <i className="bi bi-person me-2" />
                  {Userinfo.email}
                </li>
                <li>
                  <button
                    className="dropdown-item text-light d-flex align-items-center"
                    onClick={() => setShowCustomizeModal(true)}
                  >
                    <i className="bi bi-sliders me-2" />
                    Customize
                  </button>
                </li>
                <li>
                  <button
                    className="dropdown-item text-light d-flex align-items-center"
                    onClick={() => setShowSettingsModal(true)}
                  >
                    <i className="bi bi-gear me-2" />
                    Settings
                  </button>
                </li>
                <li><hr className="dropdown-divider" style={{ borderColor: '#444' }} /></li>
                <li>
                  <button
                    className="dropdown-item text-light d-flex align-items-center"
                    onClick={() => setShowHelpModal(true)}
                  >
                    <i className="bi bi-question-circle me-2" />
                    Help
                  </button>
                </li>
                <li>
                  <button className="dropdown-item text-danger d-flex align-items-center"
                    onClick={handleLogout}>
                    <i className="fa-solid fa-arrow-right-from-bracket me-2"></i>
                    Log out
                  </button>
                </li>
              </ul>
            </div>

            {/* Customize Modal */}
            <div
              className={`modal fade ${showCustomizeModal ? 'show' : ''}`}
              style={{
                display: showCustomizeModal ? 'block' : 'none',
                background: 'rgba(26, 25, 25, 0.6)'
              }}
              tabIndex="-1"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowCustomizeModal(false);
                }
              }}
            >
              <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '500px' }}>
                <div className="modal-content bg-color3 rounded-3 pb-3" ref={customizeModalRef} style={{
                  border: 'none',
                  boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)'
                }}>
                  <div className="modal-header border-0">
                    <h5 className="modal-title text-light">
                      <i className="bi bi-sliders me-2"></i>
                      Customize Your Experience
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      onClick={() => setShowCustomizeModal(false)}
                      aria-label="Close"
                    ></button>
                  </div>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label text-light">Theme</label>
                      <select
                        className="form-select bg-dark text-light border-secondary"
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                      >
                        <option>Dark</option>
                        <option>Light</option>
                        <option>System</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label text-light">Layout Density</label>
                      <select
                        className="form-select bg-dark text-light border-secondary"
                        value={layout}
                        onChange={(e) => setLayout(e.target.value)}
                      >
                        <option>Compact</option>
                        <option>Normal</option>
                        <option>Spacious</option>
                      </select>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="notificationsSwitch"
                        checked={notificationsEnabled}
                        onChange={(e) => setNotificationsEnabled(e.target.checked)}
                      />
                      <label className="form-check-label text-light" htmlFor="notificationsSwitch">
                        Enable Notifications
                      </label>
                    </div>
                  </div>
                  <div className="modal-footer border-0">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowCustomizeModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        // Save logic here
                        setShowCustomizeModal(false);
                      }}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {showCustomizeModal && <div className="modal-backdrop fade show"></div>}

            {/* Settings Modal */}
            <div
              className={`modal fade ${showSettingsModal ? 'show' : ''}`}
              style={{
                display: showSettingsModal ? 'block' : 'none',
                background: 'rgba(26, 25, 25, 0.6)'
              }}
              tabIndex="-1"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowSettingsModal(false);
                }
              }}
            >
              <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '600px' }}>
                <div className="modal-content bg-color3 rounded-3" ref={settingsModalRef} style={{
                  border: 'none',
                  boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)',
                  height: '70vh'
                }}>
                  <div className="modal-header border-0">
                    <h5 className="modal-title text-light">
                      <i className="bi bi-gear me-2"></i>
                      Settings
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      onClick={() => setShowSettingsModal(false)}
                      aria-label="Close"
                    ></button>
                  </div>

                  <div className="modal-body p-0 d-flex" style={{ overflow: 'hidden' }}>
                    {/* Settings Sidebar */}
                    <div className="border-end border-secondary" style={{ width: '180px', flexShrink: 0 }}>
                      <div className="nav flex-column nav-pills">
                        <button
                          className={`nav-link text-start text-light py-3 px-4 rounded-0 ${activeSettingsTab === 'general' ? 'active bg-primary' : 'bg-transparent'}`}
                          onClick={() => setActiveSettingsTab('general')}
                        >
                          <i className="bi bi-sliders me-2"></i>
                          General
                        </button>
                        <button
                          className={`nav-link text-start text-light py-3 px-4 rounded-0 ${activeSettingsTab === 'profile' ? 'active bg-primary' : 'bg-transparent'}`}
                          onClick={() => setActiveSettingsTab('profile')}
                        >
                          <i className="bi bi-person me-2"></i>
                          Profile
                        </button>
                        <button
                          className={`nav-link text-start text-light py-3 px-4 rounded-0 ${activeSettingsTab === 'about' ? 'active bg-primary' : 'bg-transparent'}`}
                          onClick={() => setActiveSettingsTab('about')}
                        >
                          <i className="bi bi-info-circle me-2"></i>
                          About
                        </button>
                      </div>
                    </div>

                    {/* Settings Content */}
                    <div className="flex-grow-1" style={{ overflowY: 'auto' }}>
                      {activeSettingsTab === 'general' && (
                        <div className="p-4">
                          <h6 className="text-light mb-4">General Settings</h6>

                          <div className="mb-4">
                            <label className="form-label text-light">Language</label>
                            <select
                              className="form-select bg-dark text-light border-secondary"
                              value={generalSettings.language}
                              onChange={(e) => setGeneralSettings({ ...generalSettings, language: e.target.value })}
                            >
                              <option>English</option>
                              <option>Hindi</option>
                              <option>Spanish</option>
                              <option>French</option>
                            </select>
                          </div>

                          <div className="mb-4">
                            <label className="form-label text-light">Appearance</label>
                            <div className="form-check form-switch">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="darkModeSwitch"
                                checked={generalSettings.darkMode}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, darkMode: e.target.checked })}
                              />
                              <label className="form-check-label text-light" htmlFor="darkModeSwitch">
                                Dark Mode
                              </label>
                            </div>
                          </div>

                          <div className="mb-4">
                            <label className="form-label text-light">Font Size</label>
                            <div className="btn-group w-100" role="group">
                              {['Small', 'Medium', 'Large'].map((size) => (
                                <button
                                  key={size}
                                  type="button"
                                  className={`btn ${generalSettings.fontSize === size ? 'btn-primary' : 'btn-dark'} border-secondary`}
                                  onClick={() => setGeneralSettings({ ...generalSettings, fontSize: size })}
                                >
                                  {size}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeSettingsTab === 'profile' && (
                        <div className="p-4">
                          <h6 className="text-light mb-4">Profile Settings</h6>

                          <div className="mb-4">
                            <label className="form-label text-light">Profile Picture</label>
                            <div className="d-flex align-items-center mb-3">
                              {UserImage?.picture_url ? (
                                <img
                                  src={UserImage.picture_url}
                                  alt="Profile"
                                  className="rounded-circle me-3"
                                  style={{ width: '64px', height: '64px', objectFit: 'cover' }}
                                />
                              ) : (
                                <div className="rounded-circle bg-secondary me-3 d-flex align-items-center justify-content-center"
                                  style={{ width: '64px', height: '64px' }}>
                                  <span className="text-white fs-4">
                                    {Userinfo?.username?.[0]?.toUpperCase() || 'U'}
                                  </span>
                                </div>
                              )}
                              <div>
                                <button className="btn btn-sm btn-outline-light me-2">
                                  Upload New
                                </button>
                                <button className="btn btn-sm btn-outline-danger">
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="mb-4">
                            <label className="form-label text-light">Username </label>
                            <h5 className="text-muted">@{Userinfo?.username}</h5>
                          </div>

                          <div className="mb-4">
                            <label className="form-label text-light">Email</label>
                            <h5 className="text-muted">{Userinfo?.email}</h5>

                          </div>

                          <div className="mb-4">
                            <label className="form-label text-light">Login type</label>
                            <h5 className="text-muted">{Userinfo?.auth_type}</h5>
                          </div>
                          <div className="mb-4">
                            <label className="form-label text-light">Joined :</label>
                            <small className="text-muted ms-2">
                              {formatDate(Userinfo?.created_at)}
                            </small>
                          </div>
                        </div>
                      )}

                      {activeSettingsTab === 'about' && (
                        <div className="p-4">
                          <h6 className="text-light mb-4">About</h6>

                          <div className="mb-4">
                            <div className="d-flex align-items-center mb-3">
                              <div className="me-3">
                                <i className="bi bi-info-circle fs-2 text-primary"></i>
                              </div>
                              <div>
                                <h5 className="text-light mb-0">ChatApp</h5>
                                <small className="text-muted">Version 2.4.1</small>
                              </div>
                            </div>

                            <p className="text-muted">
                              A modern chat application with AI capabilities and seamless user experience.
                            </p>
                          </div>

                          <div className="mb-4">
                            <h6 className="text-light mb-3">Resources</h6>
                            <div className="list-group">
                              <a href="/doc" className="list-group-item list-group-item-action bg-dark text-light border-secondary">
                                <i className="bi bi-file-text me-2"></i> Documentation
                              </a>
                              <a href="https://github.com/aman812845" className="list-group-item list-group-item-action bg-dark text-light border-secondary">
                                <i className="bi bi-github me-2"></i> GitHub Repository
                              </a>
                              <a href="/privacy-policy" className="list-group-item list-group-item-action bg-dark text-light border-secondary">
                                <i className="bi bi-shield-check me-2"></i> Privacy Policy
                              </a>
                            </div>
                          </div>

                          <div className="mb-4">
                            <h6 className="text-light mb-3" >Contact Us</h6>
                            <div className="d-flex gap-2">
                              <button className="btn btn-outline-light">
                                <i className="bi bi-envelope me-1"></i> Email
                              </button>
                              <button className="btn btn-outline-light">
                                <i className="bi bi-twitter me-1"></i> Twitter
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="modal-footer border-0">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowSettingsModal(false)}
                    >
                      Close
                    </button>
                    {activeSettingsTab !== 'about' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          // Save logic for the active tab
                          if (activeSettingsTab === 'general') {
                            console.log('Saving general settings:', generalSettings);
                          } else if (activeSettingsTab === 'profile') {
                            console.log('Saving profile settings:', profileSettings);
                          }
                          setShowSettingsModal(false);
                        }}
                      >
                        Save Changes
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {showSettingsModal && <div className="modal-backdrop fade show"></div>}

            {/* Help Modal */}
            <div
              className={`modal fade ${showHelpModal ? 'show' : ''}`}
              style={{
                display: showHelpModal ? 'block' : 'none',
                background: 'rgba(26, 25, 25, 0.6)'
              }}
              tabIndex="-1"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowHelpModal(false);
                }
              }}
            >
              <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '500px' }}>
                <div className="modal-content bg-color3 rounded-3 pb-3" ref={helpModalRef} style={{
                  border: 'none',
                  boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)'
                }}>
                  <div className="modal-header border-0">
                    <h5 className="modal-title text-light">
                      <i className="bi bi-question-circle me-2"></i>
                      Help Center
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      onClick={() => setShowHelpModal(false)}
                      aria-label="Close"
                    ></button>
                  </div>
                  <div className="modal-body">
                    <div className="mb-4">
                      <h6 className="text-light mb-3">Frequently Asked Questions</h6>
                      <div className="accordion" id="helpAccordion">
                        <div className="accordion-item bg-dark border-secondary">
                          <h2 className="accordion-header">
                            <button className="accordion-button bg-dark text-light" type="button" data-bs-toggle="collapse" data-bs-target="#question1">
                              How do I change my password?
                            </button>
                          </h2>
                          <div id="question1" className="accordion-collapse collapse show" data-bs-parent="#helpAccordion">
                            <div className="accordion-body text-muted">
                              You can change your password in the Security section of your Account Settings.
                            </div>
                          </div>
                        </div>
                        <div className="accordion-item bg-dark border-secondary">
                          <h2 className="accordion-header">
                            <button className="accordion-button collapsed bg-dark text-light" type="button" data-bs-toggle="collapse" data-bs-target="#question2">
                              Where can I find my billing information?
                            </button>
                          </h2>
                          <div id="question2" className="accordion-collapse collapse" data-bs-parent="#helpAccordion">
                            <div className="accordion-body text-muted">
                              Billing information is available in the Billing section of your Account Settings.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mb-3">
                      <h6 className="text-light mb-3">Contact Support</h6>
                      <button className="btn btn-outline-light me-2">
                        <i className="bi bi-chat-left-text me-1"></i> Live Chat
                      </button>
                      <button className="btn btn-outline-light">
                        <i className="bi bi-envelope me-1"></i> Email Us
                      </button>
                    </div>
                  </div>
                  <div className="modal-footer border-0">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowHelpModal(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {showHelpModal && <div className="modal-backdrop fade show"></div>}

          </div>
        </header>

        {/* Messages Area */}
        {renderMessages()}

        {/* Input Area */}
        {renderInputArea()}
      </div>

      <ToastContainer
        position="top-right"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        pauseOnHover={false}
        draggable
      />
    </div>
  );
}

export default Home;