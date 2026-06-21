#!/bin/bash
echo "Testing curl inside container:"
curl -s -o /dev/null -w "%{http_code}\n" -H "Content-Type: application/json" -d '{"contents":[{"parts":[{"text":"hi"}]}]}' "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyChhZxDDEK7nuhWVxty7-orFbLeRtDPhYs"

echo "Testing curl -4 inside container:"
curl -4 -s -o /dev/null -w "%{http_code}\n" -H "Content-Type: application/json" -d '{"contents":[{"parts":[{"text":"hi"}]}]}' "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyChhZxDDEK7nuhWVxty7-orFbLeRtDPhYs"
