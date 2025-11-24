const { withGradleProperties, withProjectBuildGradle, withDangerousMod } = require('@expo/config-plugins');
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
        
        // expo-modules-core의 build.gradle에서 kotlinVersion 참조를 수정
        // 사용자 지시에 따라 if-else 구조로 변경
        const kotlinVersionFix = `if (project.hasProperty("kotlinVersion")) {
    ext.kotlinVersion = project.kotlinVersion
} else if (rootProject.ext.has("kotlinVersion")) {
    ext.kotlinVersion = rootProject.ext.kotlinVersion
} else {
    ext.kotlinVersion = findProperty('expo.kotlin.version') ?: findProperty('KOTLIN_VERSION') ?: findProperty('android.kotlinVersion') ?: findProperty('kotlinVersion') ?: "1.9.25"
}`;
        
        // 파일 시작 부분에 ext 블록이 없으면 추가
        if (!content.includes('ext {')) {
          content = `ext {\n    ${kotlinVersionFix.replace(/\n/g, '\n    ')}\n}\n\n${content}`;
        } else {
          // ext 블록이 있으면 kotlinVersion 추가 또는 수정
          if (content.includes('kotlinVersion')) {
            // kotlinVersion이 이미 있으면 안전한 참조로 변경
            content = content.replace(
              /kotlinVersion\s*=\s*[^,\n}]+/g,
              kotlinVersionFix
            );
          } else {
            // ext 블록은 있지만 kotlinVersion이 없으면 추가
            content = content.replace(
              /(ext\s*\{)/,
              `$1\n    ${kotlinVersionFix.replace(/\n/g, '\n    ')}`
            );
          }
        }
        
        // kotlinVersion 변수 사용 부분을 안전한 참조로 변경
        // ext.kotlinVersion을 사용하도록 변경
        content = content.replace(
          /([^=])\bkotlinVersion\b(?!\s*[=:])/g,
          '$1ext.kotlinVersion'
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

module.exports = withKotlinVersion;
