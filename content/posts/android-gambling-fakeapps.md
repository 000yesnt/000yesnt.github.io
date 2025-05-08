+++
title = 'Reverse Engineering an Android Gambling Fake App'
date = 2025-05-08T13:00:00-03:00
draft = false
+++

I like to practice Android reverse engineering for fun. Every once in a while, I pick a weird-looking app on the Play Store to tinker with. In this case, I chose a type of app that pretends to be a game but instead opens up a gambling site in specific regions.

Most of the time, such apps use a combination of encryption and .dex loading, but the exact methods may vary. The sample I'm looking at in this post, called "24 Points" (`com.lododpy.yellorwwrood`), has several layers of encryption to protect its different stages - one of them delivered in a way I've never seen before.

# Context

In Brazil, some time around early 2024, there was a surge in ads for illegal gambling sites on most major platforms and advertising networks. Those ads linked to Play Store apps that pretend to be games on their listing, but include obvious references to characters in many of those gambling sites.

The apps would then redirect the user to shady websites with random names. They trick the user with claims about a "bug" in said website letting users win almost every game, or a new user bonus, or a low minimum deposit amount or whatever. It's all lies, meant to take the user's personal info and money.

![Some examples of gambling ads on YouTube and their respective Play Store listings](/images/posts/android-gambling-fakeapps/01-apps.jpg)

Currently, these ads aren't as widespread as they used to be, but they're still quite common. No platform seems to care enough to take them down.

# How those apps work

The general flow should look like this:

1. App starts in the fake "game" mode and starts doing background checks. Because decompiling a pure Java/Kotlin app is very easy compared to native code, these checks are usually done in a native library to deter analysis.
   - The exact checks that are ran vary significantly: some apps have proper anti-tampering detection, while others only check the user's region.
2. If all checks pass, the final payload is decrypted and/or extracted, then loaded with the [InMemoryDexClassLoader](https://developer.android.com/reference/dalvik/system/InMemoryDexClassLoader) class.
3. The loaded payload pauses the fake game, loads a hacked WebView overlay and shows the final page. This payload usually also sends a lot of detailed data about the device and estabilishes a [JS bridge](<https://developer.android.com/reference/android/webkit/WebView#addJavascriptInterface(java.lang.Object,%20java.lang.String)>) to run native Android code.

# Analyzing the sample

Fully unpacking the code and decrypting the stages took far longer than I had hoped. It took me a lot of poking around to do it all through Ghidra. I couldn't use dynamic instrumentation tools like Frida as it [has issues with emulated multi-arch](https://github.com/frida/frida/issues/1917) and I don't have a physical device I'm willing to use for this.

## Java

There's nothing really interesting about the Java code; all it does is start the native side and serve as a bridge for Activity launching/switching. The app's AndroidManifest indicates the final payload can manage device storage, gather network and advertising data and keep the device awake.

When dealing with these obviously-malicious apps, you can save a lot of time by looking at what's in the apk's `lib` folder. The contents indicate the kind of packing method it uses.

![](/images/posts/android-gambling-fakeapps/02.jpg)

In this case, it's a simple library. All the logic must be in there and all that needs to be done is find where it's used. Searching the decompiled code leads to this class.

![](/images/posts/android-gambling-fakeapps/03.jpg)

By reading the code, it's clear that `native frankpledgeDeflect` is where the native side starts. Therefore, it should be safe to assume the rest of the app is not important.

## Native, Stage 1

First, a quick word on static and dynamic linking.

**Dynamic** linking resolves function names based on their name. They must follow [a specific structure](https://docs.oracle.com/javase/8/docs/technotes/guides/jni/spec/design.html#resolving_native_method_names) for the JVM to recognize them.

**Static** linking doesn't need special function names. Instead, native functions are linked to Java methods in [JNI_OnLoad](https://docs.oracle.com/javase/8/docs/technotes/guides/jni/spec/invocation.html#JNJI_OnLoad), a function called by the JVM to initialize the native library.

An app can use both static and dynamic linking. It's always a good idea to take a quick look in JNI_OnLoad to see which functions are statically linked.

---

Looking inside JNI_OnLoad, we find a call to `RegisterNatives`, a function that registers native functions to Java methods. I cut the rest of the code out as it's not relevant.

![](/images/posts/android-gambling-fakeapps/04.jpg)

Here, the library first finds the class to register to (line 18), then registers a native method on that class (line 19). The content of `NATIVE_CLASS` is the name of the target class, `"com/lododpy/yellorwwrood/OveremphasizeDisemplane"`, and `JM_FRANKPLEDGE` is a `JNINativeMethod` struct containing some info about the function.

The struct is defined in the library \_INIT\_ functions:

![](/images/posts/android-gambling-fakeapps/05.jpg)

(I should mention now that this is obviously not the raw Ghidra output. I retyped and renamed variables to make the code easier to read. _This isn't a Ghidra tutorial._ For some general tips on Android and JNI reverse engineering, I find [maddiestone's Android App RE 101](https://www.ragingrock.com/AndroidAppRE/) pretty good.)

`molika` is our init function. The other function, `biemowo` will show up shortly.

![](/images/posts/android-gambling-fakeapps/06.jpg)

`setupview` sets up a FrameLayout which will contain a WebView much later in execution. If we have internet connection, the function will end at `initfb`.

Here's where the interesting stage delivery shows up: when looking into the `initfb` code...

![](/images/posts/android-gambling-fakeapps/07.jpg)

... we see a lot of references to Firebase Remote Config! Why?

### Stage 1.1: Firebase Remote Config

Remote Config is..

> ... a cloud service that lets you change the behavior and appearance of your client app or server without requiring users to download an app update. - [Firebase docs](https://firebase.google.com/docs/remote-config)

It lets developers change app settings remotely, through Firebase. What this app is probably doing is retrieving data from Firebase that will then be used later on.

Now is a good time to run the app in an emulator. I set up mitmproxy on an AVD, ran the app and waited for any requests with "firebase" in the URL.

![](/images/posts/android-gambling-fakeapps/08.jpg)

Perfect. That `data` key is likely encrypted data.

Back to the code. Scrolling to the end of the function, we can see references to methods `fetchAndActivate` and `addOnCompleteListener`, as well as our init class, `OveremphasizeDisemplane`. (Hint: [the JNI Functions list](https://docs.oracle.com/javase/8/docs/technotes/guides/jni/spec/functions.html) is very helpful for understanding what's going on.)

![](/images/posts/android-gambling-fakeapps/09.jpg)

The documentation for `fetchAndActivate` gives us the following signature and description:

> `fun fetchAndActivate(): Task<Boolean!>`
>
> Asynchronously fetches and then activates the fetched configs.
>
> \[...\] Returns: `Task` with a true result if the current call activated the fetched configs; if no configs were fetched from the backend and the local fetched configs have already been activated, returns a `Task` with a false result.

So `fetchAndActivate` returns a `Task` that indicates whether or not the app successfully downloaded the Firebase config. The refences to the init class and to `addOnCompleteListener` leads me to believe the app jumps back to Java to handle the result, and that the init class is involed.

Sure enough, in the Java code there's an `onComplete` function. (Bonus points if you caught that early!)

![](/images/posts/android-gambling-fakeapps/10.jpg)

## Native, Stage 2

I'll try to keep this brief. Jumping straight to `biemowo`, we see a class called `MainLooper` be initialized. It handles signaling for the final stages. We can also spot a function conveniently called `init` being started on a new thread.

![](/images/posts/android-gambling-fakeapps/11.jpg)

`init` then calls `loadBus`, surrounded by some code that I honestly don't know if it serves any purpose.

![](/images/posts/android-gambling-fakeapps/12.jpg)

In `loadBus` there are calls to `__android_log_print`, which prints data to logcat. The printed data might be useful so we should capture it. Running the app again with logcat open reveals:

```
05-05 15:12:35.315  9555  9642 D C_LOG   : ToCppBool>>>:1
05-05 15:12:35.366  9555  9642 D C_LOG   : requestUrl>>>decode_net:{"urlB":"hxxps[://]4gae4[.]com?ch=22925&sd=6","appsflyer_key":"","oNameListarmeabi-v7a":["cribo.mp4"],"jsCodes":["javascript: window.jsBridge = window.jsBridge || {};","javascript: window.jsBridge.postMessage = function(a,b){window.subscription.epistaxis(a,b);};"],"jsInstance":"subscription","custom_event":[{"event_ [... truncated ...]
05-05 15:12:35.367  9555  9642 D C_LOG   : fileList : oFileListx86_64 ---- nameList ： oNameListx86_64
```

The data from earlier, _now decrypted!_ We now have the final URL, as well as a bunch of info about the app, such as payload links, target regions and advertising network keys. I've cut those out. With this info, I can report all listed URLs to the relevant hosts.

From here, I could keep digging into the app to decrypt future stages and obtain more information for my reports. I did do that, but I won't be covering that process in this blogpost. It's nothing special.

In short: there are 2 additional stages before the final WebView opens the target site. They're both encrypted with different ciphers and keys.

- Stage 3 is another library containing additional code that's called by Stage 2.
- Stage 4 is a .dex file loaded with [InMemoryDexClassLoader](https://developer.android.com/reference/dalvik/system/InMemoryDexClassLoader) that places the final WebView, activates the ad SDK (Adjust) and estabilishes a JS bridge.

---

This blogpost took a suprisingly long time to write. I _really_ wanted to write about Android reverse engineering but I don't have anything new or unique to show off. Maybe I'll take a look at live, real Android malware samples in the future?

I hope this was at least somewhat interesting.
