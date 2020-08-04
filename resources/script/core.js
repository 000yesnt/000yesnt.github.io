window.onload = function() {
	//document.getElementById("cat_toggle").style.display = "block";
	HideCat();
}
function HideButton() {
	var b = document.getElementById("cat_toggle");
	b.textContent = "Show the kitty!";
	if (b.style.display === "block") {
		b.style.display = "none";
	} else {
		b.style.display = "block";
	}
}

function HideCat() {
	var cat = document.getElementById("cat");
	if (cat.style.display === "none") {
		cat.style.display = "block";
	} else {
		cat.style.display = "none";
	}
	HideButton();
}