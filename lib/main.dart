import 'dart:io'; // gives us access to file class
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/widgets.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart';


void main() async {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  final appTitle = 'Recipe Box';
  final primaryColor = Color.fromRGBO(55, 193, 255, 1);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: appTitle,
      theme: ThemeData(
        brightness: Brightness.light,
        primaryColor: primaryColor,
        accentColor: Colors.yellowAccent,
        fontFamily: 'Helvetica',
        textTheme: TextTheme(bodyText1: TextStyle(fontSize: 16.0))
      ),
      home: MyHomePage(title: appTitle, primaryColor: primaryColor),
    );
  }
}

class MyHomePage extends StatefulWidget {
  final String title;
  final Color primaryColor;

  MyHomePage({Key key, this.title, this.primaryColor}) : super(key: key);

  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  Widget widgetForBody = ImageGallery();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      // body: Column(children: <Widget> [
      //   Text('We move under cover and we move as one'),
      //   Text('hello this is some text'),
      // ]),
      body: widgetForBody,
      drawer: Drawer(
        // Add a ListView to the drawer. This ensures the user can scroll
        // through the options in the drawer if there isn't enough vertical
        // space to fit everything.
        child: ListView(
          // Important: Remove any padding from the ListView.
          padding: EdgeInsets.zero,
          children: <Widget>[
            DrawerHeader(
              child: Text('RecipeBox'),
              decoration: BoxDecoration(
                color: widget.primaryColor,
              ),
            ),
            ListTile(
              title: Text('View All Recipes'),
              onTap: () {
                setState((){
                  widgetForBody = ImageGallery();
                });
                Navigator.pop(context);
              },
            ),
            ListTile(
              title: Text('Add New Recipe'),
              onTap: () {
                setState((){
                  widgetForBody = ImageCapture();
                });
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }
}

/* Displays an aethetic grid of images from Firebase */
class ImageGallery extends StatelessWidget {
  Widget makeImagesGrid() {

    return GridView.builder(
      itemCount: 12,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2),
      itemBuilder: (BuildContext context, int index) {
        return new Card(
          child: ImageGridItem(index),
        );
      });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        child: makeImagesGrid(),
      ),
    );
  }
}

class ImageGridItem extends StatefulWidget {
  int _index;

  ImageGridItem(int index){
    this._index = index;
  }

  @override
  _ImageGridItemState createState() => _ImageGridItemState();
}

class _ImageGridItemState extends State<ImageGridItem> {
  Uint8List imageFile;
  // retrieve all images from local storage
  Future<List> getAllFiles() async {
    String directory = (await getApplicationDocumentsDirectory()).path;

    final Directory _imageDir = Directory('$directory/images/');
    if(await _imageDir.exists() == false){ //if folder already exists return path
      await _imageDir.create(recursive: true);
    }

    List<FileSystemEntity> listOfFiles = Directory("$directory/images").listSync();
    return listOfFiles;
  }

  void getImage() async {
    var items = await getAllFiles();
    Uint8List fileAsBytes;
    File file;
    if (widget._index < items.length && items[widget._index] is File) {
      file = items[widget._index];
    }

    if (file != null)
      fileAsBytes = file.readAsBytesSync();

    this.setState(() {
      imageFile = fileAsBytes;
    });
  }

  @override
  void initState() {
    super.initState();
    getImage();
  }

  @override
  Widget build(BuildContext context) {
    return GridTile(
      child: imageFile != null ? Image.memory(imageFile, fit: BoxFit.cover,) : Center(child: Text("no data")),
    );
  }
}

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
              icon: Icon(
                Icons.photo_camera,
                size: 30),
              onPressed: () => _pickImage(ImageSource.camera),
            ),
            IconButton(
              icon: Icon(
                Icons.photo_library,
                size: 30),
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
                  child: Icon(
                    Icons.crop,
                    size: 25),
                  onPressed: _cropImage,
                ),
                FlatButton(
                  child: Icon(
                    Icons.refresh,
                    size: 25),
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

// widget to upload image locally
class Uploader extends StatefulWidget {
  final File file;
  Uploader({Key key, this.file}) : super(key: key);
  createState() => _UploaderState();
}

class _UploaderState extends State<Uploader> {
  String _status; // create storage upload task

  @override
  void initState() {
    super.initState();
    _status = null;
  }

  /// Starts an upload task
  void _startUpload() async {  // starts immediately

    final Directory dir = await getApplicationDocumentsDirectory();
    final String path = dir.path;
    String filename = basename(widget.file.path);

    if (widget.file != null && path != null) {
      setState(() {
        _status = 'saving in progress...';
      });

      await widget.file.copy('$path/images/$filename');

      setState(() {
        _status = '🎉 Upload Complete! 🎉';
      });
     }
    }


  @override
  Widget build(BuildContext context) {
    if (_status != null) {
      return Column(
        children: <Widget>[
          Text(
            '$_status',
            style: DefaultTextStyle.of(context).style.apply(fontSizeFactor: 2.5),),
        ],
      );
    } else {
      // Allows user to decide when to start the upload
      return FlatButton.icon(
          label: Text(
            'Upload',
            style: DefaultTextStyle.of(context).style.apply(fontSizeFactor: 1.5),),
          icon: Icon(
            Icons.save,
            size: 30),
          onPressed: _startUpload,
        );

    }
  }
}