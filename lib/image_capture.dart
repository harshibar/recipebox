import 'dart:io'; // gives us access to file class
import 'package:flutter/material.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/widgets.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';


/* Allows us to capture or upload pictures,
   crop them, and store to Google Firebase */

/// Widget to capture and crop the image
class ImageCapture extends StatefulWidget {
  // capture image from gallery/camera, allow user to crop it
  createState() => _ImageCaptureState();
}

class _ImageCaptureState extends State<ImageCapture> {
  /// Active image file
  /// changes if user selects or crops an image
  File _imageFile;

  /// Cropper plugin
  Future<void> _cropImage() async {
    File cropped = await ImageCropper.cropImage(
        sourcePath: _imageFile.path,
        // ratioX: 1.0,
        // ratioY: 1.0,
        // maxWidth: 512,
        // maxHeight: 512,

        androidUiSettings: AndroidUiSettings(
          toolbarTitle: 'Recipe Cropper',
          toolbarColor: Colors.lightBlue,
          toolbarWidgetColor: Colors.white,
          initAspectRatio: CropAspectRatioPreset.original,
          lockAspectRatio: false),
        iosUiSettings: IOSUiSettings(
          title: 'Recipe Cropper',
        )
      );

    setState(() {
      // ?? operator returns default imageFile if no changes are made
      _imageFile = cropped ?? _imageFile;
    });
  }

  /// Select an image via gallery or camera
  Future<void> _pickImage(ImageSource source) async {
    // use ImagePicker widget
    File selected = await ImagePicker.pickImage(source: source);

    // set the selected image as state
    setState(() {
      _imageFile = selected;
    });
  }

  /// Remove image
  void _clear() {
    setState(() => _imageFile = null);
  }

  // UI Stuff
  @override
  Widget build(BuildContext context) {
    // implement buttons
    return Scaffold(

      // Select an image from the camera or gallery
      bottomNavigationBar: BottomAppBar(
        child: Row(
          children: <Widget>[
            IconButton( // maybe will take this off
              icon: Icon(Icons.photo_camera),
              onPressed: () => _pickImage(ImageSource.camera),
            ),
            IconButton(
              icon: Icon(Icons.photo_library),
              onPressed: () => _pickImage(ImageSource.gallery),
            ),
          ],
        ),
      ),

      // Preview the image and crop it
      body: ListView(
        children: <Widget>[
          if (_imageFile != null) ...[

            Image.file(_imageFile),

            Row(
              children: <Widget>[
                FlatButton(
                  child: Icon(Icons.crop),
                  onPressed: _cropImage,
                ),
                FlatButton(
                  child: Icon(Icons.refresh),
                  onPressed: _clear,
                ),
              ],
            ),

            // a custom widget - take raw file and create Firebase storage upload task
            // as a widget, you can upload multiple files at once
            Uploader(file: _imageFile)
          ]
        ],
      ),
    );
  }
}

// widget to upload image to firebase
class Uploader extends StatefulWidget {
  final File file;

  Uploader({Key key, this.file}) : super(key: key);

  createState() => _UploaderState();
}

class _UploaderState extends State<Uploader> {
  final FirebaseStorage _storage =
      // my gcs bucket location
      FirebaseStorage(storageBucket: 'gs://recipebox-53757.appspot.com/');

  StorageUploadTask _uploadTask; // create storage upload task

  /// Starts an upload task
  void _startUpload() {  // starts immediately

    /// Unique file name for the file
    /// TODO: change this to have uid with user id or something
    String filePath = 'images/${DateTime.now()}.png';

    setState(() {
      // reference storage bucket and put file in it
      _uploadTask = _storage.ref().child(filePath).putFile(widget.file);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_uploadTask != null) {
      /// exposes a stream of storageTaskEvents

      /// Manage the task state and event subscription with a StreamBuilder
      /// Listens to events listening to stream -- allows for asynchronous events?
      /// Here, it is waiting for the upload to complete
      return StreamBuilder<StorageTaskEvent>(
          stream: _uploadTask.events,
          builder: (_, snapshot) {
            // calculate progress of upload
            // updates every few milliseconds

            var event = snapshot?.data?.snapshot;

            double progressPercent = event != null
                ? event.bytesTransferred / event.totalByteCount
                : 0;

            return Column(
              // show different results depending on what is going on with the upload
                children: [
                  if (_uploadTask.isComplete)
                    Text('🎉🎉🎉'),


                  if (_uploadTask.isPaused)
                    FlatButton(
                      child: Icon(Icons.play_arrow),
                      onPressed: _uploadTask.resume,
                    ),

                  if (_uploadTask.isInProgress)
                    FlatButton(
                      child: Icon(Icons.pause),
                      onPressed: _uploadTask.pause,
                    ),

                  // Progress bar
                  LinearProgressIndicator(value: progressPercent),
                  Text(
                    '${(progressPercent * 100).toStringAsFixed(2)} % '
                  ),
                ],
              );
          });


    } else {

      // Allows user to decide when to start the upload
      return FlatButton.icon(
          label: Text('Upload to Firebase'),
          icon: Icon(Icons.cloud_upload),
          onPressed: _startUpload,
        );

    }
  }
}