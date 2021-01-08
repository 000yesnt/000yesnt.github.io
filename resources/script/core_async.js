// core_async.js - Functions for index.html that only work asynchronosuly

function trollface() {
	document.getElementById("cat").style.display = "none";
	document.getElementById("notcat").style.display = "block";
}

document.getElementById("cat").addEventListener("click", trollface);