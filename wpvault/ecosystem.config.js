module.exports = {
  apps: [
    {
      name: "wpvault-api",
      script: "python3",
      args: "-m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2",
      cwd: "/home/app",
      interpreter: "none", 
      env: { ENV: "production" },
      restart_delay: 5000,
      max_restarts: 10
    },
    {
      name: "wpvault-scheduler",
      script: "scheduler.py",
      cwd: "/home/app",
      interpreter: "python3",
      restart_delay: 10000,
      max_restarts: 10
    }
  ]
};
