const TUTORIAL_VERSION = "v1";

function getTutorialKey(userId: string) {
  return `magicbox.web.tutorial.${TUTORIAL_VERSION}.${userId}`;
}

export function hasCompletedTutorial(userId: string) {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(getTutorialKey(userId)) === "done";
}

export function completeTutorial(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getTutorialKey(userId), "done");
}
