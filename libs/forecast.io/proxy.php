<?php
// File Name: proxy.php

//$api_key = 'b962d5ee80be5293a234b69fb975629c';
$api_key = 'fc1527cde610f13ea1ac9deb8a3c5c4c';

$API_ENDPOINT = 'https://api.forecast.io/forecast/';
$url = $API_ENDPOINT . $api_key . '/';

if(!isset($_GET['url'])) die();
$url = $url . $_GET['url'];
$url = file_get_contents($url);

print_r($url);
