#!/bin/bash
echo "Testing GEMINI_API_KEY with IPv4:"
curl -4 -s -H "Content-Type: application/json" -d '{"contents":[{"parts":[{"text":"hi"}]}]}' "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyChhZxDDEK7nuhWVxty7-orFbLeRtDPhYs"
echo -e "\n"
