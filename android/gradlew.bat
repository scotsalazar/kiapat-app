@echo off

::##########################################################################

::

::  Gradle startup script for Windows

::

::##########################################################################



@if "%DEBUG%" == "" @echo off

setlocal



set DIRNAME=%~dp0

if "%DIRNAME%" == "" set DIRNAME=.

set APP_BASE_NAME=%~n0

set APP_HOME=%DIRNAME%..



set DEFAULT_JVM_OPTS=



if defined JAVA_HOME goto findJavaFromJavaHome



set JAVA_EXE=java.exe

goto init



:findJavaFromJavaHome

set JAVA_HOME=%JAVA_HOME:"=%

set JAVA_EXE=%JAVA_HOME%\bin\java.exe



:init

if exist "%JAVA_EXE%" goto execute

echo.

echo ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME%

echo.

echo Please set the JAVA_HOME variable in your environment to match the

echo location of your Java installation.

exit /b 1



:execute

set CLASSPATH=%APP_HOME%\gradle\wrapper\gradle-wrapper.jar



set CMD_LINE_ARGS=

set _SKIP=2

:argLoop

if "%~1"=="" goto endArgLoop

if "%~1"=="--" set _SKIP=1

set CMD_LINE_ARGS=%*

shift

goto argLoop

:endArgLoop



"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% -Dorg.gradle.appname=%APP_BASE_NAME% -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %CMD_LINE_ARGS%

endlocal

