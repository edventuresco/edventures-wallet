const requestBtn = document.getElementById('requestBtn');
const statusDiv = document.getElementById('status');

// Check if permission already granted
checkPermissionStatus();

requestBtn.addEventListener('click', async () => {
  try {
    statusDiv.style.display = 'block';
    statusDiv.className = 'status info';
    statusDiv.textContent = '🔄 Requesting microphone access...';

    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Stop the stream immediately - we just need the permission
    stream.getTracks().forEach(track => track.stop());

    statusDiv.className = 'status success';
    statusDiv.textContent = '✅ Microphone access granted! You can close this window.';

    // Notify parent window (if in iframe)
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'PERMISSION_GRANTED' }, '*');
    }

    // Store permission state
    chrome.storage.local.set({ microphonePermissionGranted: true });

  } catch (error) {
    console.error('Permission error:', error);

    statusDiv.className = 'status error';

    if (error.name === 'NotAllowedError') {
      statusDiv.textContent = '❌ Permission denied. Please try again and click "Allow" when prompted.';
    } else if (error.name === 'NotFoundError') {
      statusDiv.textContent = '❌ No microphone found. Please connect a microphone and try again.';
    } else {
      statusDiv.textContent = `❌ Error: ${error.message}`;
    }
  }
});

async function checkPermissionStatus() {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });

    if (result.state === 'granted') {
      statusDiv.style.display = 'block';
      statusDiv.className = 'status success';
      statusDiv.textContent = '✅ Microphone access already granted!';
      requestBtn.style.display = 'none';

      chrome.storage.local.set({ microphonePermissionGranted: true });

      if (window.parent !== window) {
        window.parent.postMessage({ type: 'PERMISSION_GRANTED' }, '*');
      }
    } else if (result.state === 'denied') {
      statusDiv.style.display = 'block';
      statusDiv.className = 'status error';
      statusDiv.textContent = '⚠️ Microphone access was denied. Click the button to request again.';
    }

    // Listen for permission changes
    result.addEventListener('change', () => {
      checkPermissionStatus();
    });
  } catch (error) {
    console.log('Permission query not supported:', error);
  }
}
