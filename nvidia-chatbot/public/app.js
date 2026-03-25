const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatForm = document.getElementById('chat-form');
const messagesContainer = document.getElementById('messages-container');
const welcomeScreen = document.getElementById('welcome-screen');
const newChatBtn = document.getElementById('new-chat-btn');

let conversationHistory = [];

messageInput.addEventListener('input', () => {
  // Auto-resize textarea
  messageInput.style.height = 'auto';
  messageInput.style.height = (messageInput.scrollHeight) + 'px';
  
  // Enable/disable send button
  sendButton.disabled = messageInput.value.trim() === '';
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendButton.disabled) {
      chatForm.dispatchEvent(new Event('submit'));
    }
  }
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const content = messageInput.value.trim();
  if (!content) return;

  // Hide welcome screen on first message
  if (welcomeScreen && welcomeScreen.style.display !== 'none') {
    welcomeScreen.style.display = 'none';
  }

  // Add user message to UI
  appendMessage('user', content);
  
  // Add to history
  conversationHistory.push({ role: 'user', content: content });

  // Reset input
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendButton.disabled = true;

  // Add typing indicator
  const typingIndicatorId = showTypingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: conversationHistory }),
    });

    removeTypingIndicator(typingIndicatorId);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch response');
    }

    const data = await response.json();
    
    // Add AI response to history
    conversationHistory.push(data);
    
    // Add AI message to UI
    appendMessage('ai', data.content);
    
  } catch (error) {
    console.error('Error:', error);
    removeTypingIndicator(typingIndicatorId);
    appendMessage('ai', `**Error:** ${error.message}. Please check if your API key is correctly configured in the backend.`);
  }
});

newChatBtn.addEventListener('click', () => {
  conversationHistory = [];
  messagesContainer.innerHTML = '';
  if (welcomeScreen) {
    welcomeScreen.style.display = 'flex';
    messagesContainer.appendChild(welcomeScreen);
  }
});

function appendMessage(sender, text) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', sender);

  const avatar = document.createElement('div');
  avatar.classList.add('avatar');
  avatar.innerHTML = sender === 'ai' ? 
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' : 
    'U';

  const contentElement = document.createElement('div');
  contentElement.classList.add('message-content');
  
  // Simple markdown-ish parsing
  let formattedText = escapeHTML(text);
  
  // Code blocks: ```language ... ```
  formattedText = formattedText.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  // Inline code: `code`
  formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold: **text**
  formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // New lines
  formattedText = formattedText.replace(/\n/g, '<br>');

  contentElement.innerHTML = formattedText;

  messageElement.appendChild(avatar);
  messageElement.appendChild(contentElement);
  
  messagesContainer.appendChild(messageElement);
  scrollToBottom();
}

function showTypingIndicator() {
  const id = 'typing-' + Date.now();
  
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', 'ai');
  messageElement.id = id;

  const avatar = document.createElement('div');
  avatar.classList.add('avatar');
  avatar.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';

  const contentElement = document.createElement('div');
  contentElement.classList.add('typing-indicator');
  contentElement.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';

  messageElement.appendChild(avatar);
  messageElement.appendChild(contentElement);
  
  messagesContainer.appendChild(messageElement);
  scrollToBottom();
  
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) {
    el.remove();
  }
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
