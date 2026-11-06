pluginManagement {
  plugins { id("com.android.application") version "8.7.3" }
  repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
  repositories { google(); mavenCentral() }
}
rootProject.name = "HitelSystemAudioLab"
