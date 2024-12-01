## Getting Started
Follow these instructions to set up and run the project locally.


### 1. Clone the Repository
First, clone the repository to your local machine using the following command:
```bash
git clone <https://github.com/amararun/shared-rexdb-file-upload> . 
```
Note: Check for the latest shared repository name in case it has changed.


### 2. Remove Statcounter Web Analytics Code Patch
I often have a Statcounter web analytics code patch in index.html. You can remove that, if it's there.


### 3. Navigate to the Frontend Directory
Move into the `frontend` directory where the application dependencies are managed:
```bash
cd frontend
```

### 4. Install Dependencies
Install the necessary dependencies using npm:
```bash
npm install
```

## 5. Update dot env  File
To be kept in the frontend folder, with the following variables. An example `.env` file is provided in the codebase for quick reference.

```env
VITE_FLOWISE_API_ENDPOINT="your_flowise_endpoint_here"  # This is the main agent chatflow deployed on Flowise AI. Chatflow and Tools schemas are shared in the docs folder. You can import them and update them with your FastAPI endpoint URLs.
VITE_API_ENDPOINT="your_api_endpoint_here"  # This is the endpoint URL for the FastAPI server.
VITE_OPENAI_API_KEY="your_openai_api_key_here"  # Your OpenAI API Key.
```

## 5A. Update flowise url in chat-box.tsx component
There is one hardcoded flowise URL that remained to be linked to environment variable. Will fix that. Meanwhile, you would need to manually add that in chat-box.tsx on line number 109. 

### 6. Run the Development Server
Start the development server:
```bash
npm run dev
```
The application should now be running locally. 
