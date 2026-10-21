# Deploy VesperAI to Google Cloud Run

1. Install the gcloud CLI and sign in: `gcloud auth login`
2. Pick a project: `gcloud config set project YOUR_PROJECT_ID`
3. From this folder run:

   gcloud run deploy vesperai --source . --region us-central1 --allow-unauthenticated

4. gcloud prints a public https://vesperai-xxxx.run.app link.

Note: Cloud Run's disk is temporary, so the learned knowledge.json resets when the instance restarts.
