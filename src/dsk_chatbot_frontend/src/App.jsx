import { useState, useEffect } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';

// Automatically detect the environment
const isLocal = window.location.origin.includes("127.0.0.1");

// Set network host accordingly
const NETWORK_HOST = isLocal ? "http://127.0.0.1:8000" : "https://icp-api.io";

// Replace this with your real canister ID on the IC mainnet
const CANISTER_ID = isLocal
    ? "bkyz2-fmaaa-aaaaa-qaaaq-cai"  // Local canister ID
    : "6cy57-laaaa-aaaad-aajsq-cai";    // Mainnet canister ID

console.log("Using Network Host:", NETWORK_HOST);
console.log("Using Canister ID:", CANISTER_ID);

const idlFactory = ({ IDL }) => {
    return IDL.Service({
        'sendMessage': IDL.Func([IDL.Text], [IDL.Text], []),
        'getStatus': IDL.Func([], [IDL.Text], ['query']),
    });
};

function App() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [actor, setActor] = useState(null);
    const [error, setError] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('Initializing...');

    useEffect(() => {
        async function init() {
            try {
                setConnectionStatus('Connecting to backend...');
                console.log('Initializing with:', { NETWORK_HOST, CANISTER_ID });

                const agent = new HttpAgent({ host: NETWORK_HOST });

                // Fetch root key only for local development
                if (isLocal) {
                    await agent.fetchRootKey();
                }

                const actorInstance = Actor.createActor(idlFactory, {
                    agent,
                    canisterId: CANISTER_ID,
                });

                try {
                    console.log('Testing connection...');
                    const status = await actorInstance.getStatus();
                    console.log('Backend status:', status);
                    setActor(actorInstance);
                    setError(null);
                    setConnectionStatus('Connected');
                } catch (e) {
                    console.error('Status check failed:', e);
                    throw new Error(`Connection verification failed: ${e.message}`);
                }
            } catch (error) {
                console.error('Initialization error:', error);
                setError(`Failed to initialize: ${error.message}`);
                setConnectionStatus('Connection failed');
            }
        }

        init();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || !actor) return;

        try {
            setIsLoading(true);
            setMessages(prev => [...prev, { type: 'user', content: input }]);

            console.log('Sending message:', input);
            const response = await actor.sendMessage(input);
            console.log('Received response:', response);

            setMessages(prev => [...prev, { type: 'bot', content: response }]);
            setInput('');
        } catch (error) {
            console.error('Message error:', error);
            setMessages(prev => [...prev, { type: 'error', content: `Error: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-4">
                <div className="mb-4">
                    <div className={`text-sm ${
                        connectionStatus === 'Connected' ? 'text-green-600' : 
                        connectionStatus === 'Connecting to backend...' ? 'text-yellow-600' : 
                        'text-red-600'
                    }`}>
                        Status: {connectionStatus}
                    </div>
                    <div className="text-xs text-gray-500">
                        Canister ID: {CANISTER_ID}
                    </div>
                    <div className="text-xs text-gray-500">
                        Host: {NETWORK_HOST}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                        {error}
                        <div className="mt-2 text-sm">
                            Make sure dfx is running with: <code>dfx start --clean</code>
                        </div>
                    </div>
                )}

                <div className="space-y-4 mb-4 h-[500px] overflow-y-auto">
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`p-3 rounded-lg ${
                                message.type === 'user' 
                                    ? 'bg-blue-100 ml-auto max-w-[80%]' 
                                    : message.type === 'error'
                                    ? 'bg-red-100 mx-auto max-w-[90%]'
                                    : 'bg-gray-100 mr-auto max-w-[80%]'
                            }`}
                        >
                            {message.content}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                    )}
                </div>
                
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        disabled={isLoading || !actor}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !actor}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
}

export default App;
