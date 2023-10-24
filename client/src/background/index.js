console.log("this is the background file")

let currentIndex;
let allLinks = [];
let currentTabUrl = '';
let jobApplicationsStatus = [];

function updateCurrentTabUrl() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) {
      currentTabUrl = tabs[0].url;
    }
  });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === 'startJobAutomation') {
    const targetURL = message.targetURL;
    currentIndex = message.currentApplicationIndex;
    chrome.tabs.create({ url: targetURL }, function (newTab) {
      chrome.scripting.executeScript({
        target: { tabId: newTab.id },
        files: ['content.js']
      }, function () {
        chrome.tabs.sendMessage(newTab.id, { type: 'startAutomation', targetURL: targetURL, jobApplicationCount: message.jobApplicationCount });
      });
    });
  } else if (message.type === 'extractedJobLinks') {
    //Assign all the extracted Job Links to allLinks array.
    allLinks = message.links;
    processLinks(sender.tab.id);

  } else if (message.type === "detectedJobApplicationQuestions") {
    postJobApplicationQuestion(currentTabUrl, message.questions);
  }
  return true;
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {

  if (tabId && tab.url) {
    if (tab.url.includes("apply#")) {
      if (changeInfo.status === "complete") {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content_script_job_submit.js']
        });
      }
    } else if (tab.url.includes("thanks")) {
      if (changeInfo.status === "complete") {
        jobApplicationsStatus.push({ url: currentTabUrl, status: 'Successful' });
        processLinks(tabId);

      }
    } else if (tab.url.includes("already-received")) {
      if (changeInfo.status === "complete") {
        jobApplicationsStatus.push({ url: currentTabUrl, status: 'Already Received' });
        processLinks(tabId);
      }
    }
  }
});

//Process Each Link in the array
function processLinks(tabId) {

  if (currentIndex < allLinks.length) {
    if ((currentIndex !== 0) && (currentIndex % 5 === 0)) {
      batchUpdateJobApplicationStatus();
    }
    const nextUrl = allLinks[currentIndex];
    currentTabUrl = nextUrl;
    chrome.tabs.update(tabId, { url: nextUrl })
    currentIndex = currentIndex + 1;
  } else {
    batchUpdateJobApplicationStatus();
    console.log("All URLs processed");
  }
}

//API Calls to server
async function batchUpdateJobApplicationStatus() {
  console.log("inside batch Update Job Application Status");
  try {
    const response = await fetch('http://localhost:5000/api/job-application-details/batch-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobApplicationsStatus),
    });
    if (response.ok) {
      const data = await response.json();
      console.log(data);
      jobApplicationsStatus = [];
      console.log('Batch update sent successfully.');
    } else {
      console.log(error);
      console.error('Failed to send batch update.');
    }
  } catch (error) {
    console.error('Error while sending batch update:', error);
  }
}

async function postJobApplicationQuestion(url, questions) {
  try {
    const response = await fetch('http://localhost:5000/api/job-application-details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        questions: questions,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      console.log(data);
    } else {
      console.error('Request failed');
    }
  } catch (error) {
    console.error(error);
  }
}