const { withGradleProperties, withProjectBuildGradle, withAppBuildGradle, withDangerousMod, withInfoPlist, withPodfileProperties } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Kotlin 1.9.25 영구 고정 플러그인
 * buildscript {} 블록은 유지하되, Kotlin 버전만 1.9.25로 강제
 */
const withKotlinVersion = (config) => {
  // 1. gradle.properties에 Kotlin 버전 설정 (모든 프로젝트에서 접근 가능)
  config = withGradleProperties(config, (config) => {
    const existingProps = config.modResults || [];
    
    const kotlinVersionProp = existingProps.find(
      (prop) => prop.key === 'kotlinVersion'
    );
    
    if (!kotlinVersionProp) {
      config.modResults.push({
        type: 'property',
        key: 'kotlinVersion',
        value: '1.9.25',
      });
    } else {
      kotlinVersionProp.value = '1.9.25';
    }
    
    // android.kotlinVersion도 설정 (일부 모듈에서 사용)
    const androidKotlinVersionProp = existingProps.find(
      (prop) => prop.key === 'android.kotlinVersion'
    );
    
    if (!androidKotlinVersionProp) {
      config.modResults.push({
        type: 'property',
        key: 'android.kotlinVersion',
        value: '1.9.25',
      });
    } else {
      androidKotlinVersionProp.value = '1.9.25';
    }
    
    return config;
  });
  
  // 2. 루트 build.gradle에서 buildscript {} 블록을 먼저 처리하고, plugins {} 블록을 그 뒤에 배치
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;
      
      // [1] buildscript {} 블록은 유지하되, Kotlin 버전만 1.9.25로 강제
      // ext {} 블록에서 kotlinVersion을 1.9.25로 강제 교체
      contents = contents.replace(
        /kotlinVersion\s*=\s*findProperty\(['"]android\.kotlinVersion['"]\)\s*\?:\s*['"][^'"]+['"]/g,
        "kotlinVersion = '1.9.25'"
      );
      
      // ext {} 블록에서 kotlinVersion이 없으면 추가
      const buildscriptExtMatch = contents.match(/(buildscript\s*\{[\s\S]*?ext\s*\{)([\s\S]*?)(\n\s*\})/);
      if (buildscriptExtMatch && !buildscriptExtMatch[2].includes('kotlinVersion')) {
        contents = contents.replace(
          /(buildscript\s*\{[\s\S]*?ext\s*\{)([\s\S]*?)(\n\s*\})/,
          `$1$2        kotlinVersion = '1.9.25'\n$3`
        );
      }
      
      // classpath에서 Kotlin 버전을 변수로 사용하도록 보장 (이미 되어있을 수 있음)
      contents = contents.replace(
        /classpath\s*\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin:[^'"]+['"]\)/g,
        "classpath(\"org.jetbrains.kotlin:kotlin-gradle-plugin:\${kotlinVersion}\")"
      );
      
      // [2] plugins {} 블록을 buildscript {} 블록 뒤로 이동 (Gradle 규칙: buildscript가 먼저 와야 함)
      // 1. 기존 plugins {} 블록 추출 및 제거
      let pluginsContent = '';
      const pluginsMatch = contents.match(/plugins\s*\{([\s\S]*?)\n\}/);
      if (pluginsMatch) {
        pluginsContent = pluginsMatch[1];
        
        // Kotlin 플러그인 버전 강제
        pluginsContent = pluginsContent.replace(
          /id\s+['"]org\.jetbrains\.kotlin\.android['"]\s+version\s+['"]1\.9\.24['"]/g,
          "id \"org.jetbrains.kotlin.android\" version \"1.9.25\""
        );
        pluginsContent = pluginsContent.replace(
          /id\s+['"]org\.jetbrains\.kotlin\.android['"]\s+version\s+['"]([^'"]+)['"]/g,
          "id \"org.jetbrains.kotlin.android\" version \"1.9.25\""
        );
        
        if (pluginsContent.includes('org.jetbrains.kotlin.android')) {
          if (!pluginsContent.match(/id\s+['"]org\.jetbrains\.kotlin\.android['"]\s+version/)) {
            pluginsContent = pluginsContent.replace(
              /(id\s+['"]org\.jetbrains\.kotlin\.android['"])/,
              "$1 version \"1.9.25\""
            );
          }
        } else {
          pluginsContent += '\n    id "org.jetbrains.kotlin.android" version "1.9.25" apply false';
        }
        
        // plugins {} 블록 제거
        contents = contents.replace(/plugins\s*\{[\s\S]*?\n\}\s*/g, '');
      } else {
        // plugins {} 블록이 없으면 생성
        pluginsContent = '    id "org.jetbrains.kotlin.android" version "1.9.25" apply false';
      }
      
      // 2. buildscript {} 블록 찾기 및 그 뒤에 plugins {} 블록 추가
      const buildscriptEndRegex = /(buildscript\s*\{[\s\S]*?\n\})/;
      const buildscriptMatch = contents.match(buildscriptEndRegex);
      if (buildscriptMatch) {
        // buildscript {} 블록 뒤에 plugins {} 블록 추가
        contents = contents.replace(
          buildscriptEndRegex,
          `$1\n\nplugins {\n${pluginsContent}\n}`
        );
      } else {
        // buildscript {} 블록이 없으면 최상단에 추가 (이 경우는 거의 없음)
        contents = `plugins {\n${pluginsContent}\n}\n\n${contents}`;
      }
      
      // [3] allprojects 블록에 Ads 강제 고정 추가
      const allprojectsRegex = /allprojects\s*\{([\s\S]*?)\n\}/;
      const allprojectsMatch = contents.match(allprojectsRegex);
      
      if (allprojectsMatch) {
        let allprojectsContent = allprojectsMatch[1];
        
        // configurations.configureEach가 없으면 추가
        if (!allprojectsContent.includes('configurations.configureEach')) {
          // repositories 블록 뒤에 추가
          allprojectsContent += `
    configurations.configureEach {
        resolutionStrategy {
            force 'com.google.android.gms:play-services-ads:23.4.0',
                  'com.google.android.gms:play-services-ads-lite:23.4.0',
                  'com.google.android.gms:play-services-ads-base:23.4.0'
        }
    }`;
          
          contents = contents.replace(
            allprojectsRegex,
            `allprojects {${allprojectsContent}\n}`
          );
        } else {
          // 이미 있으면 force 블록 확인 및 업데이트
          allprojectsContent = allprojectsContent.replace(
            /force\s+['"]com\.google\.android\.gms:play-services-ads:[^'"]+['"]/g,
            "force 'com.google.android.gms:play-services-ads:23.4.0',\n                  'com.google.android.gms:play-services-ads-lite:23.4.0',\n                  'com.google.android.gms:play-services-ads-base:23.4.0'"
          );
          
          contents = contents.replace(
            allprojectsRegex,
            `allprojects {${allprojectsContent}\n}`
          );
        }
      } else {
        // allprojects 블록이 없으면 추가
        contents += `
allprojects {
    repositories {
        google()
        mavenCentral()
    }
    configurations.configureEach {
        resolutionStrategy {
            force 'com.google.android.gms:play-services-ads:23.4.0',
                  'com.google.android.gms:play-services-ads-lite:23.4.0',
                  'com.google.android.gms:play-services-ads-base:23.4.0'
        }
    }
}`;
      }
      
      // 여러 빈 줄 정리
      contents = contents.replace(/\n{3,}/g, '\n\n');
      
      config.modResults.contents = contents;
    }
    return config;
  });
  
  // 3. 모든 서브프로젝트 및 node_modules의 expo-modules-core에서 kotlinVersion 설정
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidRoot = config.modRequest.platformProjectRoot;
      
      // expo-modules-core의 build.gradle 파일 수정
      const expoModulesCorePath = path.join(projectRoot, 'node_modules', 'expo-modules-core', 'android', 'build.gradle');
      if (fs.existsSync(expoModulesCorePath)) {
        let content = fs.readFileSync(expoModulesCorePath, 'utf8');
        const originalContent = content;
        
        // ext 블록이 없으면 먼저 추가
        if (!content.includes('ext {')) {
          content = `ext {\n    kotlinVersion = findProperty('kotlinVersion') ?: findProperty('android.kotlinVersion') ?: "1.9.25"\n}\n\n${content}`;
        } else if (!content.match(/ext\s*\{[^}]*kotlinVersion/)) {
          // ext 블록은 있지만 kotlinVersion이 없으면 추가
          content = content.replace(
            /(ext\s*\{)/,
            `$1\n    kotlinVersion = findProperty('kotlinVersion') ?: findProperty('android.kotlinVersion') ?: "1.9.25"`
          );
        }
        
        // kotlinVersion() 메서드 호출을 findProperty로 직접 참조하도록 변경
        // ext가 초기화되기 전에 접근하는 것을 방지
        content = content.replace(
          /kotlinVersion\(\)/g,
          'findProperty("kotlinVersion") ?: findProperty("android.kotlinVersion") ?: "1.9.25"'
        );
        
        if (content !== originalContent) {
          fs.writeFileSync(expoModulesCorePath, content, 'utf8');
          console.log('Modified expo-modules-core/android/build.gradle');
        }
      } else {
        console.log('expo-modules-core/android/build.gradle not found at:', expoModulesCorePath);
      }
      
      // 모든 build.gradle 파일 검색 (android 폴더 내)
      const findGradleFiles = (dir) => {
        const files = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.gradle') {
            files.push(...findGradleFiles(fullPath));
          } else if (entry.isFile() && entry.name === 'build.gradle') {
            files.push(fullPath);
          }
        }
        
        return files;
      };
      
      const gradleFiles = findGradleFiles(androidRoot);
      
      for (const gradleFile of gradleFiles) {
        let content = fs.readFileSync(gradleFile, 'utf8');
        const originalContent = content;
        
        // plugins 블록에서 1.9.24 제거 및 1.9.25로 교체
        content = content.replace(
          /id\s+['"]org\.jetbrains\.kotlin\.android['"]\s+version\s+['"]1\.9\.24['"]/g,
          "id \"org.jetbrains.kotlin.android\" version \"1.9.25\""
        );
        
        // 서브모듈에서 kotlin 플러그인 버전 직접 지정 제거 (버전만 제거)
        // plugins { id "org.jetbrains.kotlin.android" version "1.9.24" } → plugins { id "org.jetbrains.kotlin.android" }
        content = content.replace(
          /id\s+['"]org\.jetbrains\.kotlin\.android['"]\s+version\s+['"][^'"]+['"]/g,
          "id \"org.jetbrains.kotlin.android\""
        );
        
        // ext 블록에서 1.9.24 제거
        content = content.replace(
          /kotlinVersion\s*=\s*['"]1\.9\.24['"]/g,
          "kotlinVersion = '1.9.25'"
        );
        
        // classpath에서 1.9.24 제거
        content = content.replace(
          /classpath\s+['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin:1\.9\.24['"]/g,
          "classpath \"org.jetbrains.kotlin:kotlin-gradle-plugin:\${kotlinVersion}\""
        );
        
        if (content !== originalContent) {
          fs.writeFileSync(gradleFile, content, 'utf8');
        }
      }
      
      return config;
    },
  ]);
  
  return config;
};

/**
 * iOS Firebase 설정 플러그인
 * Podfile에 Firebase SDK 추가 및 AppDelegate 초기화
 */
const withFirebaseIOS = (config) => {
  // Podfile에 Firebase SDK 추가
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = config.modRequest.platformProjectRoot;
      const podfilePath = path.join(iosRoot, 'Podfile');
      
      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');
        const originalContent = podfileContent;
        
        // Firebase SDK가 이미 추가되어 있는지 확인
        if (!podfileContent.includes('Firebase/Analytics') && !podfileContent.includes('Firebase/Messaging')) {
          // use_frameworks! 블록 찾기
          const useFrameworksMatch = podfileContent.match(/use_frameworks!\s*:linkage\s*=>\s*:static/);
          
          if (useFrameworksMatch) {
            // Firebase SDK 추가 (use_frameworks! 블록 뒤에)
            const firebasePods = `
  # Firebase SDK
  pod 'Firebase/Analytics'
  pod 'Firebase/Messaging'
`;
            podfileContent = podfileContent.replace(
              /(use_frameworks!\s*:linkage\s*=>\s*:static)/,
              `$1${firebasePods}`
            );
          } else {
            // use_frameworks! 블록이 없으면 추가
            const targetMatch = podfileContent.match(/(target\s+['"][^'"]+['"]\s+do)/);
            if (targetMatch) {
              const firebasePods = `
  use_frameworks! :linkage => :static
  
  # Firebase SDK
  pod 'Firebase/Analytics'
  pod 'Firebase/Messaging'
`;
              podfileContent = podfileContent.replace(
                /(target\s+['"][^'"]+['"]\s+do)/,
                `$1${firebasePods}`
              );
            }
          }
        }
        
        if (podfileContent !== originalContent) {
          fs.writeFileSync(podfilePath, podfileContent, 'utf8');
          console.log('Updated Podfile with Firebase SDK');
        }
      }
      
      // AppDelegate 파일 찾기 및 Firebase 초기화 코드 추가
      const findAppDelegate = (dir) => {
        const files = [];
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && entry.name !== 'Pods' && entry.name !== '.git') {
              files.push(...findAppDelegate(fullPath));
            } else if (entry.isFile() && (entry.name === 'AppDelegate.swift' || entry.name === 'AppDelegate.m' || entry.name === 'AppDelegate.mm')) {
              files.push(fullPath);
            }
          }
        } catch (e) {
          // 디렉토리를 읽을 수 없으면 무시
        }
        return files;
      };
      
      const appDelegateFiles = findAppDelegate(iosRoot);
      
      for (const appDelegatePath of appDelegateFiles) {
        let content = fs.readFileSync(appDelegatePath, 'utf8');
        const originalContent = content;
        const isSwift = appDelegatePath.endsWith('.swift');
        
        if (isSwift) {
          // Swift AppDelegate
          // FirebaseCore import 추가
          if (!content.includes('import FirebaseCore')) {
            content = content.replace(
              /(import\s+[^\n]+\n)/,
              "$1import FirebaseCore\n"
            );
          }
          
          // FirebaseApp.configure() 추가
          if (!content.includes('FirebaseApp.configure()')) {
            // application(_:didFinishLaunchingWithOptions:) 메서드 찾기
            const didFinishLaunchingMatch = content.match(/(func\s+application\([^)]+\)\s+->\s+Bool\s*\{[\s\S]*?)(return\s+true)/);
            if (didFinishLaunchingMatch) {
              content = content.replace(
                /(func\s+application\([^)]+\)\s+->\s+Bool\s*\{[\s\S]*?)(return\s+true)/,
                "$1    FirebaseApp.configure()\n    $2"
              );
            } else {
              // 메서드가 없으면 추가
              const classMatch = content.match(/(@main\s+class\s+[^\s]+\s*:\s*[^\s]+\s*\{)/);
              if (classMatch) {
                content = content.replace(
                  /(@main\s+class\s+[^\s]+\s*:\s*[^\s]+\s*\{)/,
                  `$1\n    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {\n        FirebaseApp.configure()\n        return true\n    }`
                );
              }
            }
          }
        } else {
          // Objective-C AppDelegate
          // FirebaseCore import 추가
          if (!content.includes('#import <FirebaseCore/FirebaseCore.h>')) {
            content = content.replace(
              /(#import\s+[^\n]+\n)/,
              "$1#import <FirebaseCore/FirebaseCore.h>\n"
            );
          }
          
          // FirebaseApp configure 추가
          if (!content.includes('[FirebaseApp configure]')) {
            const didFinishLaunchingMatch = content.match(/(-?\s*\(BOOL\)\s*application:\([^)]+\)\s+didFinishLaunchingWithOptions:\([^)]+\)\s*\{[\s\S]*?)(return\s+YES;)/);
            if (didFinishLaunchingMatch) {
              content = content.replace(
                /(-?\s*\(BOOL\)\s*application:\([^)]+\)\s+didFinishLaunchingWithOptions:\([^)]+\)\s*\{[\s\S]*?)(return\s+YES;)/,
                "$1    [FirebaseApp configure];\n    $2"
              );
            }
          }
        }
        
        if (content !== originalContent) {
          fs.writeFileSync(appDelegatePath, content, 'utf8');
          console.log(`Updated ${appDelegatePath} with Firebase initialization`);
        }
      }
      
      return config;
    },
  ]);
  
  return config;
};

/**
 * Firebase 설정 플러그인
 * Google Services 플러그인과 Firebase SDK 추가
 */
const withFirebase = (config) => {
  // 1. 프로젝트 레벨 build.gradle에 Google Services 플러그인 추가
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;
      
      // plugins {} 블록에 Google Services 플러그인 추가
      const pluginsMatch = contents.match(/plugins\s*\{([\s\S]*?)\n\}/);
      if (pluginsMatch) {
        let pluginsContent = pluginsMatch[1];
        
        // 이미 Google Services 플러그인이 있는지 확인
        if (!pluginsContent.includes('com.google.gms.google-services')) {
          // Google Services 플러그인 추가
          pluginsContent += '\n    id("com.google.gms.google-services") version "4.4.4" apply false';
          contents = contents.replace(
            /plugins\s*\{[\s\S]*?\n\}/,
            `plugins {\n${pluginsContent}\n}`
          );
        }
      } else {
        // plugins {} 블록이 없으면 생성
        contents = `plugins {\n    id("com.google.gms.google-services") version "4.4.4" apply false\n}\n\n${contents}`;
      }
      
      config.modResults.contents = contents;
    } else if (config.modResults.language === 'kotlin') {
      // Kotlin DSL 지원
      let contents = config.modResults.contents;
      
      const pluginsMatch = contents.match(/plugins\s*\{([\s\S]*?)\n\}/);
      if (pluginsMatch) {
        let pluginsContent = pluginsMatch[1];
        
        if (!pluginsContent.includes('com.google.gms.google-services')) {
          pluginsContent += '\n    id("com.google.gms.google-services") version "4.4.4" apply false';
          contents = contents.replace(
            /plugins\s*\{[\s\S]*?\n\}/,
            `plugins {\n${pluginsContent}\n}`
          );
        }
      } else {
        contents = `plugins {\n    id("com.google.gms.google-services") version "4.4.4" apply false\n}\n\n${contents}`;
      }
      
      config.modResults.contents = contents;
    }
    
    return config;
  });
  
  // 2. 앱 레벨 build.gradle에 Google Services 플러그인과 Firebase SDK 추가
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;
      
      // plugins {} 블록에 Google Services 플러그인 추가
      const pluginsMatch = contents.match(/plugins\s*\{([\s\S]*?)\n\}/);
      if (pluginsMatch) {
        let pluginsContent = pluginsMatch[1];
        
        if (!pluginsContent.includes('com.google.gms.google-services')) {
          pluginsContent += '\n    id("com.google.gms.google-services")';
          contents = contents.replace(
            /plugins\s*\{[\s\S]*?\n\}/,
            `plugins {\n${pluginsContent}\n}`
          );
        }
      } else {
        // plugins {} 블록이 없으면 생성
        contents = `plugins {\n    id("com.google.gms.google-services")\n}\n\n${contents}`;
      }
      
      // dependencies {} 블록에 Firebase SDK 추가
      const dependenciesMatch = contents.match(/dependencies\s*\{([\s\S]*?)\n\}/);
      if (dependenciesMatch) {
        let dependenciesContent = dependenciesMatch[1];
        
        // Firebase BoM이 이미 있는지 확인
        if (!dependenciesContent.includes('firebase-bom')) {
          // Firebase BoM 추가
          dependenciesContent = `    // Import the Firebase BoM\n    implementation(platform("com.google.firebase:firebase-bom:34.7.0"))\n    \n    // Firebase Analytics\n    implementation("com.google.firebase:firebase-analytics")\n    \n    // Firebase Cloud Messaging (FCM)\n    implementation("com.google.firebase:firebase-messaging")\n${dependenciesContent}`;
          contents = contents.replace(
            /dependencies\s*\{[\s\S]*?\n\}/,
            `dependencies {\n${dependenciesContent}\n}`
          );
        }
      } else {
        // dependencies {} 블록이 없으면 생성
        contents += `\n\ndependencies {\n    // Import the Firebase BoM\n    implementation(platform("com.google.firebase:firebase-bom:34.7.0"))\n    \n    // Firebase Analytics\n    implementation("com.google.firebase:firebase-analytics")\n    \n    // Firebase Cloud Messaging (FCM)\n    implementation("com.google.firebase:firebase-messaging")\n}`;
      }
      
      config.modResults.contents = contents;
    } else if (config.modResults.language === 'kotlin') {
      // Kotlin DSL 지원
      let contents = config.modResults.contents;
      
      const pluginsMatch = contents.match(/plugins\s*\{([\s\S]*?)\n\}/);
      if (pluginsMatch) {
        let pluginsContent = pluginsMatch[1];
        
        if (!pluginsContent.includes('com.google.gms.google-services')) {
          pluginsContent += '\n    id("com.google.gms.google-services")';
          contents = contents.replace(
            /plugins\s*\{[\s\S]*?\n\}/,
            `plugins {\n${pluginsContent}\n}`
          );
        }
      } else {
        contents = `plugins {\n    id("com.google.gms.google-services")\n}\n\n${contents}`;
      }
      
      const dependenciesMatch = contents.match(/dependencies\s*\{([\s\S]*?)\n\}/);
      if (dependenciesMatch) {
        let dependenciesContent = dependenciesMatch[1];
        
        if (!dependenciesContent.includes('firebase-bom')) {
          dependenciesContent = `    // Import the Firebase BoM\n    implementation(platform("com.google.firebase:firebase-bom:34.7.0"))\n    \n    // Firebase Analytics\n    implementation("com.google.firebase:firebase-analytics")\n    \n    // Firebase Cloud Messaging (FCM)\n    implementation("com.google.firebase:firebase-messaging")\n${dependenciesContent}`;
          contents = contents.replace(
            /dependencies\s*\{[\s\S]*?\n\}/,
            `dependencies {\n${dependenciesContent}\n}`
          );
        }
      } else {
        contents += `\n\ndependencies {\n    // Import the Firebase BoM\n    implementation(platform("com.google.firebase:firebase-bom:34.7.0"))\n    \n    // Firebase Analytics\n    implementation("com.google.firebase:firebase-analytics")\n    \n    // Firebase Cloud Messaging (FCM)\n    implementation("com.google.firebase:firebase-messaging")\n}`;
      }
      
      config.modResults.contents = contents;
    }
    
    return config;
  });
  
  return config;
};

// 모든 플러그인을 결합
const withCombinedPlugins = (config) => {
  config = withKotlinVersion(config);
  config = withFirebase(config); // Android Firebase
  config = withFirebaseIOS(config); // iOS Firebase
  return config;
};

module.exports = withCombinedPlugins;
