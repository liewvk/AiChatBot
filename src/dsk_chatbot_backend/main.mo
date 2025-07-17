import Debug "mo:base/Debug";
import Text "mo:base/Text";
import Error "mo:base/Error";
import IC "ic:aaaaa-aa";
import Nat64 "mo:base/Nat64";
import Cycles "mo:base/ExperimentalCycles";

actor Chatbot {
    // Hugging Face API Key
    private let HF_API_KEY = "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";

    // Model names
    private let MATH_MODEL = "mrm8488/t5-base-finetuned-question-generation-ap";
    private let QA_MODEL = "facebook/bart-large-cnn";

    // Hugging Face API URL
    private let HF_API_URL = "https://api-inference.huggingface.co/models/";

    // Function to detect if the input is a math-related question
    private func isMathQuestion(input: Text) : Bool {
        Text.contains(input, #text "+") or
        Text.contains(input, #text "-") or
        Text.contains(input, #text "=") or
        Text.contains(input, #text "multiply") or 
        Text.contains(input, #text "add ")
    };

    // Public function to send a message to the backend and get a response
    public shared func sendMessage(userInput : Text) : async Text {
        try {
            // Allocate sufficient cycles for the HTTP request
            Cycles.add(21_000_000_000); // Sufficient cycles to cover the cost

            // Determine the model and prompt based on the input
            let (model, prompt) = if (isMathQuestion(userInput)) {
                (MATH_MODEL, "solve: " # userInput)
            } else {
                (QA_MODEL, userInput)
            };

            // Construct the request body
            let requestBody = "{\"inputs\":\"" # Text.replace(prompt, #text "\"", "\\\"") # "\"}";

            // Define the HTTP request arguments
            let request : IC.http_request_args = {
                url = HF_API_URL # model;
                max_response_bytes = ?Nat64.fromNat(2_000_000); // Convert Nat to Nat64
                method = #post;
                headers = [
                    { name = "Content-Type"; value = "application/json" },
                    { name = "Authorization"; value = "Bearer " # HF_API_KEY }
                ];
                body = ?Text.encodeUtf8(requestBody);
                transform = null;
            };

            // Explicitly declare the `system` capability
            let response = await IC.http_request<system>(request);

            // Decode and process the response
            switch (Text.decodeUtf8(response.body)) {
                case (?decoded) {
                    if (response.status >= 200 and response.status < 300) {
                        if (Text.contains(decoded, #text "generated_text")) {
                            let parts = Text.split(decoded, #text "\":\"");
                            switch (parts.next()) {
                                case (?_) {
                                    switch (parts.next()) {
                                        case (?content) {
                                            let cleanParts = Text.split(content, #text "\"}");
                                            switch (cleanParts.next()) {
                                                case (?answer) {
                                                    let cleaned = Text.trim(answer, #text " \n\t");
                                                    return if (cleaned == "") "Please rephrase." else cleaned;
                                                };
                                                case null { return content };
                                            };
                                        };
                                        case null { return decoded };
                                    };
                                };
                                case null { return decoded };
                            };
                        };
                        return decoded;
                    };

                    // Handle non-successful HTTP status codes
                    Debug.print("Error: " # decoded);
                    return "Service unavailable. Try again.";
                };
                case null { return "Failed to process response." };
            };
        } catch (error) { 
            // Log and return any errors encountered during execution
            Debug.print(Error.message(error));
            return "Error: " # Error.message(error); 
        };
    };

    // Public query function to check the status of the chatbot
    public query func getStatus() : async Text {
        return "✅ Ready";
    };
}
