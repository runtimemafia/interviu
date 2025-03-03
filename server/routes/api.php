<?php

use App\Http\Controllers\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix("/user")->group(function () {
    
    Route::get("/login/google", [UserController::class, "register_with_google"]);
    
});
